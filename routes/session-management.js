const express = require('express');
const router = express.Router();
const Database = require('../config');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET /api/sessions - List current user's active sessions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const sessions = await Database.query(
      `SELECT id, ip_address, mac_address, user_agent, device_fingerprint,
              is_trusted, is_current, is_active, created_at, last_activity, expires_at
       FROM user_sessions
       WHERE user_id = ? AND is_active = 1 AND expires_at > NOW()
       ORDER BY last_activity DESC`,
      [req.user.id]
    );

    res.json({
      data: sessions.map(s => ({
        ...s,
        is_current: s.id === req.headers['x-session-id'] ? true : s.is_current,
      })),
    });
  } catch (error) {
    console.error('List sessions error:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// DELETE /api/sessions/:id - Force-logout a specific session
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const session = await Database.selectOne(
      'user_sessions', 'id, user_id', 'id = ? AND user_id = ?', [id, req.user.id]
    );

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await Database.update('user_sessions',
      { is_active: 0, expires_at: new Date() },
      'id = ?', [id]
    );

    await Database.logAudit(req.user.id, 'SESSION_REVOKED', 'user_sessions', id, null, null, req.ip);

    res.json({ success: true, message: 'Session terminated' });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

// DELETE /api/sessions - Force-logout all sessions except current
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const currentSessionId = req.headers['x-session-id'];

    const result = await Database.query(
      `UPDATE user_sessions SET is_active = 0, expires_at = NOW()
       WHERE user_id = ? AND is_active = 1 AND id != ?`,
      [req.user.id, currentSessionId || '']
    );

    await Database.logAudit(req.user.id, 'ALL_SESSIONS_REVOKED', 'user_sessions', null,
      null, { count: result.affectedRows }, req.ip);

    res.json({ success: true, message: `${result.affectedRows} sessions terminated` });
  } catch (error) {
    console.error('Revoke all sessions error:', error);
    res.status(500).json({ error: 'Failed to revoke sessions' });
  }
});

// Admin: GET /api/sessions/admin/:userId - List sessions for a specific user
router.get('/admin/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const sessions = await Database.query(
      `SELECT id, ip_address, mac_address, user_agent, device_fingerprint,
              is_trusted, is_current, is_active, created_at, last_activity, expires_at
       FROM user_sessions
       WHERE user_id = ?
       ORDER BY last_activity DESC
       LIMIT 50`,
      [userId]
    );

    res.json({ data: sessions });
  } catch (error) {
    console.error('Admin list sessions error:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// Admin: DELETE /api/sessions/admin/:sessionId - Force-logout any user's session
router.delete('/admin/:sessionId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Database.selectOne('user_sessions', 'id, user_id', 'id = ?', [sessionId]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await Database.update('user_sessions',
      { is_active: 0, expires_at: new Date() },
      'id = ?', [sessionId]
    );

    await Database.logAudit(req.user.id, 'ADMIN_SESSION_REVOKED', 'user_sessions', sessionId,
      null, { target_user_id: session.user_id }, req.ip);

    res.json({ success: true, message: 'Session terminated' });
  } catch (error) {
    console.error('Admin revoke session error:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

module.exports = router;
