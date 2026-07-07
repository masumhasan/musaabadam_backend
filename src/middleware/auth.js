const { verifyToken, verifyAdminToken } = require('../utils/jwtService');
const User = require('../models/User');
const Admin = require('../models/Admin');
const { HTTP_STATUS } = require('../config/constants');

// Verifies JWT access token, attaches req.user with full Mongoose document
const authenticateUser = async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (decoded.type) {
      // Reject non-access tokens (e.g. email_verify, password_reset)
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Invalid token type' });
    }

    const user = await User.findById(decoded.sub).select('-passwordHash');
    if (!user || !user.isAccountAccessible()) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Account not accessible' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Restricts to one or more roles
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({ success: false, message: 'Insufficient role' });
  }
  next();
};

// Restricts to specific marketplace permission string
const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
  }
  if (!req.user.hasPermission(permission)) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({ success: false, message: 'Permission denied' });
  }
  next();
};

// Verifies admin JWT access token, attaches req.admin
const authenticateAdmin = async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyAdminToken(token);

    const admin = await Admin.findById(decoded.sub).select('-passwordHash -totpSecret');
    if (!admin || !admin.isActive) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Admin account not accessible' });
    }

    req.admin = admin;
    next();
  } catch {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Restricts to a specific admin permission (super_admin always passes)
const requireAdminPermission = (permission) => (req, res, next) => {
  if (!req.admin) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
  }
  if (!req.admin.hasPermission(permission)) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({ success: false, message: 'Permission denied' });
  }
  next();
};

module.exports = { authenticateUser, requireRole, requirePermission, authenticateAdmin, requireAdminPermission };
