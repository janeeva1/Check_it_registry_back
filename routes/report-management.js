// Report Management Routes - MySQL Version
const express = require('express');
const router = express.Router();
const Database = require('../config');
const { authenticateToken, collectAuditContext } = require('../middleware/auth');
const RevenueService = require('../services/RevenueService');
const SecurityService = require('../services/SecurityService');
const FraudDetectionService = require('../services/FraudDetectionService');
const NotificationService = require('../services/NotificationService');
const EmailTemplate = require('../services/EmailTemplate');

router.use(authenticateToken);
router.use(collectAuditContext);

// GET /api/report-management - List user's reports
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, report_type } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    let whereClause = 'r.reporter_id = ?';
    let whereParams = [userId];

    if (status) {
      whereClause += ' AND r.status = ?';
      whereParams.push(status);
    }

    if (report_type) {
      whereClause += ' AND r.report_type = ?';
      whereParams.push(report_type);
    }

    const reports = await Database.query(`
      SELECT 
        r.*,
        d.brand,
        d.model,
        d.imei,
        d.serial,
        lea.agency_name,
        lea.contact_email as lea_email
      FROM reports r
      JOIN devices d ON r.device_id = d.id
      LEFT JOIN law_enforcement_agencies lea ON r.assigned_lea_id = lea.id
      WHERE ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `, [...whereParams, limit, offset]);

    const [{ total }] = await Database.query(
      `SELECT COUNT(*) as total FROM reports r WHERE ${whereClause}`,
      whereParams
    );

    res.json({
      data: reports,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/report-management/:case_id - Get specific report
router.get('/:case_id', async (req, res) => {
  try {
    const caseId = req.params.case_id;
    const userId = req.user.id;
    const userRole = req.user.role;

    let whereClause = 'r.case_id = ?';
    let whereParams = [caseId];

    // Non-admin users can only see their own reports
    if (userRole !== 'admin' && userRole !== 'lea') {
      whereClause += ' AND r.reporter_id = ?';
      whereParams.push(userId);
    }

    const report = await Database.queryOne(`
      SELECT 
        r.*,
        d.brand,
        d.model,
        d.imei,
        d.serial,
        u.name as reporter_name,
        u.email as reporter_email,
        lea.agency_name,
        lea.contact_email as lea_email
      FROM reports r
      JOIN devices d ON r.device_id = d.id
      LEFT JOIN users u ON r.reporter_id = u.id
      LEFT JOIN law_enforcement_agencies lea ON r.assigned_lea_id = lea.id
      WHERE ${whereClause}
    `, whereParams);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/report-management - Create new report
router.post('/', async (req, res) => {
  try {
    const { device_id, report_type, description, occurred_at, location, evidence_url } = req.body;
    const userId = req.user.id;

    if (!device_id || !report_type || !description || !occurred_at) {
      return res.status(400).json({ 
        error: 'device_id, report_type, description, and occurred_at are required' 
      });
    }

    if (!['stolen', 'lost', 'found'].includes(report_type)) {
      return res.status(400).json({ 
        error: 'report_type must be stolen, lost, or found' 
      });
    }

    /* Revenue & Security checks for non-found reports */
    if (report_type !== 'found') {
      const device = await Database.selectOne(
        'devices',
        'user_id, status',
        'id = ?',
        [device_id]
      );

      if (!device || device.user_id !== userId) {
        return res.status(404).json({ 
          error: 'Device not found or unauthorized' 
        });
      }

      const existingReport = await Database.selectOne(
        'reports',
        'id',
        'device_id = ? AND status = ?',
        [device_id, 'open']
      );

      if (existingReport) {
        return res.status(409).json({ 
          error: 'Device already has an active report' 
        });
      }

      /* Require NIN verification before first report */
      if (!req.user.is_verified) {
        return res.status(403).json({
          error: 'Identity verification required before reporting.',
          requiresAction: 'nin_verification',
          message: 'Please complete NIN verification first. A verification fee applies.'
        });
      }

      /* Fraud check */
      const fraudCheck = await FraudDetectionService.checkAndFlag(userId, 'REPORT_DEVICE', {
        ipAddress: req.clientIp,
        macAddress: req.macAddress,
        deviceId
      });
      if (fraudCheck.blocked) {
        return res.status(403).json({ error: 'Reporting blocked due to security concerns. Contact support.' });
      }

      /* Charge report verification fee after free reports per device exceeded */
      const shouldCharge = await RevenueService.shouldChargeForReport(userId, device_id);
      if (shouldCharge) {
        const fee = await RevenueService.getFee('report_verification_fee');
        if (fee > 0) {
          const { pay_by_pass } = req.body;
          if (!pay_by_pass) {
            const reference = `RPT-${userId}-${Date.now()}`;
            const invoiceId = await RevenueService.createPaymentInvoice(
              userId, fee, 'report_verification',
              reference,
              { device_id, report_type }
            );
            return res.json({
              requiresPayment: true,
              invoiceId,
              reference,
              amount: fee,
              purpose: 'Report Verification Fee',
              message: `Free reports for this device exceeded. Payment of ₦${fee} required for this report.`
            });
          }
        }
      }
    }

    // Get user's region for LEA assignment
    const user = await Database.selectOne('users', 'region', 'id = ?', [userId]);
    const userRegion = user?.region || 'default';

    // Find appropriate LEA
    const lea = await Database.selectOne(
      'law_enforcement_agencies',
      'id',
      'region = ? AND active = 1',
      [userRegion]
    );

    // Generate case ID
    const caseId = Database.generateCaseId();

    // Create report
    const reportId = Database.generateUUID();
    const reportData = {
      id: reportId,
      device_id,
      report_type,
      reporter_id: userId,
      description,
      occurred_at: new Date(occurred_at),
      location: location || null,
      evidence_url: evidence_url || null,
      status: 'open',
      case_id: caseId,
      assigned_lea_id: lea?.id || null,
      created_at: new Date(),
      updated_at: new Date()
    };

    await Database.transaction(async (connection) => {
      // Insert report with explicit columns to avoid SQL syntax errors
      await connection.execute(
        `INSERT INTO reports (
          id, device_id, report_type, reporter_id, description, occurred_at,
          location, evidence_url, status, case_id, assigned_lea_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reportData.id,
          reportData.device_id,
          reportData.report_type,
          reportData.reporter_id,
          reportData.description,
          reportData.occurred_at,
          reportData.location,
          reportData.evidence_url,
          reportData.status,
          reportData.case_id,
          reportData.assigned_lea_id,
          reportData.created_at,
          reportData.updated_at
        ]
      );

      // Update device status
      if (report_type === 'stolen' || report_type === 'lost') {
        await connection.execute(
          'UPDATE devices SET status = ?, updated_at = ? WHERE id = ?',
          [report_type, new Date(), device_id]
        );
      }

    });

    // Send notifications outside transaction
    try {
      const userDetails = await Database.selectOne('users', 'name, email', 'id = ?', [userId]);
      const deviceInfo = await Database.selectOne('devices', 'brand, model, imei', 'id = ?', [device_id]);

      // Notify reporter
      const reportSubject = `Report Filed - Case ${caseId}`;
      const reportMessage = `
        <p>Hello <strong>${userDetails?.name || 'User'}</strong>,</p>
        <p>Your <strong>${report_type}</strong> report has been filed successfully.</p>
        <div style="background: #F3F4F6; border-radius: 8px; padding: 16px; margin: 15px 0;">
          <table cellpadding="4" cellspacing="0" style="font-size: 14px; color: #374151;">
            <tr><td style="font-weight: 600; padding-right: 12px;">Case ID:</td><td>${caseId}</td></tr>
            <tr><td style="font-weight: 600; padding-right: 12px;">Device:</td><td>${deviceInfo?.brand || ''} ${deviceInfo?.model || ''}</td></tr>
            <tr><td style="font-weight: 600; padding-right: 12px;">IMEI:</td><td>${deviceInfo?.imei || 'N/A'}</td></tr>
            <tr><td style="font-weight: 600; padding-right: 12px;">Status:</td><td>Open</td></tr>
          </table>
        </div>
        <p>Law enforcement has been notified and will review your case. You will receive updates as it progresses.</p>
      `;
      const wrappedHtml = EmailTemplate.wrapContent(reportSubject, reportMessage);
      await NotificationService.queueNotification(
        userId, 'email', req.user.email, reportSubject, wrappedHtml,
        { caseId, type: 'report_filed', deviceInfo: deviceInfo ? `${deviceInfo.brand} ${deviceInfo.model}` : '' }
      );

      // Notify LEA if assigned
      if (lea) {
        const leaDetails = await Database.selectOne('law_enforcement_agencies', 'agency_name, contact_email', 'id = ?', [lea.id]);
        if (leaDetails) {
          const leaSubject = `New ${report_type} Report - Case ${caseId}`;
          await NotificationService.notifyLEANewCase(lea.id, {
            case_id: caseId,
            report_type,
            device_brand: deviceInfo?.brand || 'Unknown',
            device_model: deviceInfo?.model || 'Unknown',
            device_imei: deviceInfo?.imei || null,
            location: location || 'Not specified',
            occurred_at
          });
        }
      }
    } catch (notifyErr) {
      console.error('Failed to queue report notifications:', notifyErr);
    }

    // Log critical action
    await SecurityService.logCriticalAction(userId, 'REPORT_DEVICE', {
      success: true,
      deviceId: device_id,
      reference: reportId,
      ipAddress: req.clientIp,
      userAgent: req.userAgent,
      macAddress: req.macAddress,
      oldValues: null,
      newValues: { report_type, case_id: caseId },
      executionTime: 0
    });

    // Mark verification fee as paid if applicable
    if (report_type !== 'found' && req.body.pay_by_pass) {
      await Database.update('reports',
        { verification_fee_paid: true, fee_transaction_id: req.body.pay_by_pass },
        'id = ?', [reportId]);
    }

    // Get the created report with details
    const report = await Database.queryOne(`
      SELECT 
        r.*,
        d.brand,
        d.model,
        d.imei,
        d.serial,
        lea.agency_name,
        lea.contact_email as lea_email
      FROM reports r
      JOIN devices d ON r.device_id = d.id
      LEFT JOIN law_enforcement_agencies lea ON r.assigned_lea_id = lea.id
      WHERE r.id = ?
    `, [reportId]);

    res.status(201).json(report);
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/report-management/:case_id - Update report (LEA/Admin only)
router.put('/:case_id', async (req, res) => {
  try {
    const caseId = req.params.case_id;
    const userId = req.user.id;
    const userRole = req.user.role;
    const updateData = req.body;

    if (userRole !== 'admin' && userRole !== 'lea') {
      return res.status(403).json({ 
        error: 'Only administrators and law enforcement can update reports' 
      });
    }

    // Get existing report
    const existingReport = await Database.selectOne(
      'reports',
      '*',
      'case_id = ?',
      [caseId]
    );

    if (!existingReport) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Update report
    updateData.updated_at = new Date();
    await Database.update('reports', updateData, 'case_id = ?', [caseId]);

    // Log audit
    await Database.logAudit(
      userId,
      'UPDATE',
      'reports',
      existingReport.id,
      { status: existingReport.status },
      { status: updateData.status },
      req.ip
    );

    // Get updated report
    const report = await Database.queryOne(`
      SELECT 
        r.*,
        d.brand,
        d.model,
        d.imei,
        d.serial,
        lea.agency_name,
        lea.contact_email as lea_email
      FROM reports r
      JOIN devices d ON r.device_id = d.id
      LEFT JOIN law_enforcement_agencies lea ON r.assigned_lea_id = lea.id
      WHERE r.case_id = ?
    `, [caseId]);

    res.json(report);
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;