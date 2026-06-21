const User = require('../../../models/User');
const AdminLog = require('../../../models/AdminLog');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS } = require('../../../config/constants');

const LIST_SELECT = 'email username displayName role isActive isBanned isEmailVerified suspendedUntil avatarUrl createdAt lastLoginAt';

const listUsers = async ({ search, role, status, page = 1, limit = 20 }) => {
  const query = { deletedAt: null };

  if (search) {
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ email: re }, { username: re }, { displayName: re }];
  }
  if (role) query.role = role;
  if (status === 'banned') query.isBanned = true;
  else if (status === 'inactive') query.isActive = false;
  else if (status === 'active') { query.isActive = true; query.isBanned = false; }

  const skip = (Number(page) - 1) * Number(limit);
  const [users, total] = await Promise.all([
    User.find(query).select(LIST_SELECT).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    User.countDocuments(query),
  ]);

  return { users, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
};

const getUser = async (userId) => {
  const user = await User.findOne({ _id: userId, deletedAt: null }).select('-passwordHash -fcmTokens -blockedUsers');
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  return user;
};

const suspendUser = async (userId, adminId, { reason, days = 7 }, meta) => {
  const user = await User.findOne({ _id: userId, deletedAt: null });
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  if (user.isBanned) throw new AppError('User is permanently banned', HTTP_STATUS.CONFLICT);

  user.suspendedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await user.save();

  await AdminLog.create({ adminId, action: 'SUSPEND_USER', targetId: userId, targetModel: 'User', metadata: { reason, days }, ...meta });
  return user;
};

const banUser = async (userId, adminId, { reason }, meta) => {
  const user = await User.findOne({ _id: userId, deletedAt: null });
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);

  user.isBanned = true;
  user.banReason = reason;
  user.bannedAt = new Date();
  user.bannedBy = adminId;
  await user.save();

  await AdminLog.create({ adminId, action: 'BAN_USER', targetId: userId, targetModel: 'User', metadata: { reason }, ...meta });
  return user;
};

const activateUser = async (userId, adminId, meta) => {
  const user = await User.findOne({ _id: userId, deletedAt: null });
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);

  user.isBanned = false;
  user.banReason = undefined;
  user.bannedAt = undefined;
  user.bannedBy = undefined;
  user.suspendedUntil = undefined;
  user.isActive = true;
  await user.save();

  await AdminLog.create({ adminId, action: 'ACTIVATE_USER', targetId: userId, targetModel: 'User', ...meta });
  return user;
};

const deleteUser = async (userId, adminId, meta) => {
  const user = await User.findOne({ _id: userId, deletedAt: null });
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);

  // Anonymize unique fields so their values are freed for re-registration.
  // The AdminLog entry retains the audit trail via targetId.
  user.email = `deleted_${userId}@deleted.invalid`;
  user.username = `deleted_${userId}`;
  user.deletedAt = new Date();
  user.isActive = false;
  await user.save();

  await AdminLog.create({ adminId, action: 'DELETE_USER', targetId: userId, targetModel: 'User', ...meta });
};

module.exports = { listUsers, getUser, suspendUser, banUser, activateUser, deleteUser };
