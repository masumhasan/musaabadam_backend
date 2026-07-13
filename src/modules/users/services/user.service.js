const User = require('../../../models/User');
const Follower = require('../../../models/Follower');
const Order = require('../../../models/Order');
const { generateUniqueReferralCode } = require('../../../utils/referral');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS, SELLER_STATUS } = require('../../../config/constants');

const getProfile = async (userId) => {
  const user = await User.findById(userId).select('-passwordHash');
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  return user.toPrivateProfile();
};

const updateProfile = async (userId, updates) => {
  const allowed = ['displayName', 'bio', 'location', 'avatarUrl', 'coverImageUrl', 'socialLinks', 'mutedWords', 'isPrivate'];
  const filtered = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: filtered },
    { new: true, runValidators: true }
  ).select('-passwordHash');

  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  return user.toPrivateProfile();
};

const getAddresses = async (userId) => {
  const user = await User.findById(userId).select('addresses');
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  return user.addresses;
};

const addAddress = async (userId, addressData) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);

  const type = addressData.type || 'shipping';
  if (addressData.isDefault) {
    user.addresses
      .filter((a) => a.type === type)
      .forEach((a) => { a.isDefault = false; });
  }
  user.addresses.push(addressData);
  await user.save();
  return user.addresses;
};

const updateAddress = async (userId, addressId, addressData) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);

  const addr = user.addresses.id(addressId);
  if (!addr) throw new AppError('Address not found', HTTP_STATUS.NOT_FOUND);

  const type = addressData.type || addr.type;
  if (addressData.isDefault) {
    user.addresses
      .filter((a) => a.type === type && a._id.toString() !== addressId)
      .forEach((a) => { a.isDefault = false; });
  }
  Object.assign(addr, addressData);
  await user.save();
  return user.addresses;
};

const deleteAddress = async (userId, addressId) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);

  const addr = user.addresses.id(addressId);
  if (!addr) throw new AppError('Address not found', HTTP_STATUS.NOT_FOUND);

  addr.deleteOne();
  await user.save();
  return user.addresses;
};

const getPublicProfile = async (userId, viewerId = null) => {
  const user = await User.findById(userId).select('-passwordHash -fcmTokens -blockedUsers -googleId -appleId');
  if (!user || user.deletedAt) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);

  const profile = user.toPublicProfile();

  if (viewerId && viewerId.toString() !== userId.toString()) {
    const [following, blockedByMe] = await Promise.all([
      Follower.exists({ followerId: viewerId, followingId: userId }),
      User.exists({ _id: viewerId, blockedUsers: userId }),
    ]);
    profile.isFollowing = !!following;
    profile.isBlockedByMe = !!blockedByMe;
  }

  return profile;
};

const updateNotificationPreferences = async (userId, preferences) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { notificationPreferences: preferences } },
    { new: true, runValidators: true }
  ).select('notificationPreferences');
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  return user.notificationPreferences;
};

const updateAppPreferences = async (userId, preferences) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { appPreferences: preferences } },
    { new: true, runValidators: true }
  ).select('appPreferences');
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  return user.appPreferences;
};

const applyAsSeller = async (userId, data) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);

  const currentStatus = user.sellerProfile?.status;
  if (currentStatus === SELLER_STATUS.PENDING) {
    throw new AppError('Application already submitted and is under review', HTTP_STATUS.CONFLICT);
  }
  if (currentStatus === SELLER_STATUS.APPROVED) {
    throw new AppError('Account is already approved as a seller', HTTP_STATUS.CONFLICT);
  }

  user.sellerProfile = {
    status: SELLER_STATUS.PENDING,
    primaryCategory: data.primaryCategory,
    subcategory: Array.isArray(data.subcategories) ? data.subcategories.join(', ') : '',
    sellerType: data.sellerType,
    businessAddress: data.businessAddress,
    averageEarningRange: data.averageEarningRange,
    identityDocUrl: data.identityDocUrl,
    businessLicenseUrl: data.businessLicenseUrl,
    appliedAt: new Date(),
  };

  await user.save();
  return user.toPrivateProfile();
};

const updateKyc = async (userId, data) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);

  if (!user.sellerProfile) {
    user.sellerProfile = {
      status: SELLER_STATUS.PENDING,
      primaryCategory: 'General',
      appliedAt: new Date(),
    };
  }

  if (data.identityDocUrl !== undefined) user.sellerProfile.identityDocUrl = data.identityDocUrl;
  if (data.businessLicenseUrl !== undefined) user.sellerProfile.businessLicenseUrl = data.businessLicenseUrl;

  // If not already approved, set status to pending to request review
  if (user.sellerProfile.status !== SELLER_STATUS.APPROVED) {
    user.sellerProfile.status = SELLER_STATUS.PENDING;
    user.sellerProfile.appliedAt = new Date();
  }

  await user.save();
  return user.toPrivateProfile();
};

const getReferralInfo = async (userId) => {
  const user = await User.findById(userId).select('referralCode rewardPoints');
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);

  // Backfill a code for accounts created before referral codes existed.
  if (!user.referralCode) {
    user.referralCode = await generateUniqueReferralCode(User);
    await user.save();
  }

  const referredIds = await User.find({ referredBy: userId, deletedAt: null }).distinct('_id');
  const totalReferred = referredIds.length;

  const completedBuyerIds = totalReferred
    ? await Order.distinct('buyerId', { buyerId: { $in: referredIds }, isPaid: true })
    : [];
  const complete = completedBuyerIds.length;
  const pending = Math.max(0, totalReferred - complete);

  return {
    referralCode: user.referralCode,
    stats: {
      credit: user.rewardPoints || 0,
      complete,
      pending,
      totalReferred,
    },
  };
};

module.exports = {
  getProfile,
  updateProfile,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  getPublicProfile,
  updateNotificationPreferences,
  updateAppPreferences,
  applyAsSeller,
  updateKyc,
  getReferralInfo,
};
