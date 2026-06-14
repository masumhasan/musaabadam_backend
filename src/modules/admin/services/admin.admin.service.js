const Admin = require('../../../models/Admin');
const AdminLog = require('../../../models/AdminLog');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS, ADMIN_ROLES, ADMIN_PERMISSIONS } = require('../../../config/constants');

const ROLE_DEFAULT_PERMISSIONS = {
  [ADMIN_ROLES.SUPPORT_AGENT]: [
    ADMIN_PERMISSIONS.VIEW_USERS,
    ADMIN_PERMISSIONS.SUSPEND_USERS,
    ADMIN_PERMISSIONS.VIEW_REPORTS,
  ],
  [ADMIN_ROLES.MODERATOR]: [
    ADMIN_PERMISSIONS.VIEW_USERS,
    ADMIN_PERMISSIONS.SUSPEND_USERS,
    ADMIN_PERMISSIONS.VIEW_REPORTS,
    ADMIN_PERMISSIONS.TERMINATE_STREAMS,
  ],
  [ADMIN_ROLES.FINANCE_ADMIN]: [
    ADMIN_PERMISSIONS.VIEW_USERS,
    ADMIN_PERMISSIONS.ISSUE_REFUNDS,
    ADMIN_PERMISSIONS.APPROVE_PAYOUTS,
    ADMIN_PERMISSIONS.VIEW_ANALYTICS,
    ADMIN_PERMISSIONS.VIEW_REPORTS,
  ],
  [ADMIN_ROLES.SUPER_ADMIN]: Object.values(ADMIN_PERMISSIONS),
};

const listAdmins = async ({ page = 1, limit = 20 }) => {
  const skip = (Number(page) - 1) * Number(limit);
  const [admins, total] = await Promise.all([
    Admin.find().select('-passwordHash -totpSecret').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Admin.countDocuments(),
  ]);
  return { admins, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
};

const createAdmin = async ({ email, password, firstName, lastName, role, permissions }, createdBy, meta) => {
  const existing = await Admin.findOne({ email: email.toLowerCase().trim() });
  if (existing) throw new AppError('Email already registered', HTTP_STATUS.CONFLICT);

  const resolvedPermissions = permissions ?? ROLE_DEFAULT_PERMISSIONS[role] ?? [];

  const admin = await Admin.create({
    email,
    passwordHash: password,
    firstName,
    lastName,
    role,
    permissions: resolvedPermissions,
    createdBy,
  });

  await AdminLog.create({ adminId: createdBy, action: 'CREATE_ADMIN', targetId: admin._id, targetModel: 'Admin', ...meta });

  const { passwordHash: _ph, totpSecret: _ts, ...safe } = admin.toObject();
  return safe;
};

const toggleAdminActive = async (adminId, isActive, requestingAdminId, meta) => {
  const admin = await Admin.findById(adminId).select('-passwordHash -totpSecret');
  if (!admin) throw new AppError('Admin not found', HTTP_STATUS.NOT_FOUND);
  if (admin._id.equals(requestingAdminId)) throw new AppError('Cannot modify your own account', HTTP_STATUS.FORBIDDEN);

  admin.isActive = isActive;
  await admin.save();

  await AdminLog.create({ adminId: requestingAdminId, action: isActive ? 'ACTIVATE_ADMIN' : 'DEACTIVATE_ADMIN', targetId: adminId, targetModel: 'Admin', ...meta });
  return admin;
};

module.exports = { listAdmins, createAdmin, toggleAdminActive };
