const User = require('../../../models/User');
const AdminLog = require('../../../models/AdminLog');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS, ROLES, SELLER_STATUS } = require('../../../config/constants');

const SELLER_SELECT = 'email username displayName avatarUrl sellerProfile createdAt isEmailVerified';

const listSellers = async ({ status, page = 1, limit = 20 }) => {
  const query = { deletedAt: null };

  if (status) {
    query['sellerProfile.status'] = status;
  } else {
    query['sellerProfile'] = { $ne: null };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [sellers, total] = await Promise.all([
    User.find(query).select(SELLER_SELECT).sort({ 'sellerProfile.appliedAt': -1 }).skip(skip).limit(Number(limit)),
    User.countDocuments(query),
  ]);

  return { sellers, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
};

const approveSeller = async (userId, adminId, meta) => {
  const user = await User.findOne({ _id: userId, deletedAt: null });
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  if (!user.sellerProfile) throw new AppError('No seller application found', HTTP_STATUS.BAD_REQUEST);
  if (user.sellerProfile.status !== SELLER_STATUS.PENDING) {
    throw new AppError('Application is not in pending state', HTTP_STATUS.CONFLICT);
  }

  user.role = ROLES.SELLER;
  user.sellerProfile.status = SELLER_STATUS.APPROVED;
  user.sellerProfile.approvedAt = new Date();
  await user.save();

  await AdminLog.create({ adminId, action: 'APPROVE_SELLER', targetId: userId, targetModel: 'User', ...meta });
  return user;
};

const rejectSeller = async (userId, adminId, { reason }, meta) => {
  const user = await User.findOne({ _id: userId, deletedAt: null });
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  if (!user.sellerProfile) throw new AppError('No seller application found', HTTP_STATUS.BAD_REQUEST);
  if (user.sellerProfile.status !== SELLER_STATUS.PENDING) {
    throw new AppError('Application is not in pending state', HTTP_STATUS.CONFLICT);
  }

  user.sellerProfile.status = SELLER_STATUS.REJECTED;
  user.sellerProfile.rejectedAt = new Date();
  user.sellerProfile.rejectionReason = reason;
  await user.save();

  await AdminLog.create({ adminId, action: 'REJECT_SELLER', targetId: userId, targetModel: 'User', metadata: { reason }, ...meta });
  return user;
};

const requestMoreInfo = async (userId, adminId, { note }, meta) => {
  const user = await User.findOne({ _id: userId, deletedAt: null });
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  if (!user.sellerProfile) throw new AppError('No seller application found', HTTP_STATUS.BAD_REQUEST);

  user.sellerProfile.status = SELLER_STATUS.NEEDS_MORE_INFO;
  user.sellerProfile.rejectionReason = note;
  await user.save();

  await AdminLog.create({ adminId, action: 'SELLER_NEEDS_MORE_INFO', targetId: userId, targetModel: 'User', metadata: { note }, ...meta });
  return user;
};

module.exports = { listSellers, approveSeller, rejectSeller, requestMoreInfo };
