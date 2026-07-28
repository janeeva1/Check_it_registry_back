// 2FA enforcement middleware for admin and LEA roles
// Checks two_factor_enabled on users table and enforces MFA verification

const Database = require('../config');

const requireMFA = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Only enforce for admin and LEA roles
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && req.user.role !== 'lea') {
      return next();
    }

    // Check if user has 2FA enabled
    const user = await Database.selectOne(
      'users', 'two_factor_enabled, two_fa_enabled', 'id = ?', [req.user.id]
    );

    const mfaEnabled = user?.two_factor_enabled || user?.two_fa_enabled;

    if (!mfaEnabled) {
      // 2FA not enabled — require setup before proceeding
      return res.status(403).json({
        error: 'Two-factor authentication is required for your role',
        requiresAction: '2fa_setup',
        message: 'Please enable 2FA in your profile settings before accessing this resource.'
      });
    }

    // Verify MFA token from header (set after successful MFA verification via security-routes)
    const mfaVerified = req.headers['x-mfa-verified'];
    const mfaToken = req.headers['x-mfa-token'];

    if (!mfaVerified || !mfaToken) {
      return res.status(403).json({
        error: 'MFA verification required',
        requiresAction: 'mfa_verify',
        message: 'This action requires recent MFA verification. Call POST /api/security/mfa/initiate first.'
      });
    }

    // Validate the MFA token is not expired (10 minute window)
    try {
      const payload = JSON.parse(Buffer.from(mfaToken.split('.')[1], 'base64').toString());
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        return res.status(403).json({
          error: 'MFA token expired',
          requiresAction: 'mfa_verify',
          message: 'MFA token has expired. Please re-verify.'
        });
      }
      if (payload.type !== 'mfa_token' || payload.userId !== req.user.id) {
        return res.status(403).json({
          error: 'Invalid MFA token',
          requiresAction: 'mfa_verify'
        });
      }
    } catch (e) {
      return res.status(403).json({
        error: 'Invalid MFA token',
        requiresAction: 'mfa_verify'
      });
    }

    next();
  } catch (error) {
    console.error('MFA enforcement error:', error);
    return res.status(500).json({ error: 'MFA verification failed' });
  }
};

// Enforce 2FA setup completion — blocks admin/LEA until 2FA is enabled
const require2FASetup = async (req, res, next) => {
  try {
    if (!req.user) return next();

    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && req.user.role !== 'lea') {
      return next();
    }

    const user = await Database.selectOne(
      'users', 'two_factor_enabled, two_fa_enabled', 'id = ?', [req.user.id]
    );

    const mfaEnabled = user?.two_factor_enabled || user?.two_fa_enabled;

    if (!mfaEnabled) {
      return res.status(403).json({
        error: 'Two-factor authentication setup required',
        requiresAction: '2fa_setup',
        message: 'Admin and LEA accounts must enable 2FA. Visit PUT /api/profile/2fa to enable.'
      });
    }

    next();
  } catch (error) {
    next();
  }
};

module.exports = { requireMFA, require2FASetup };
