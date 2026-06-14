const Follower = require('../../../models/Follower');
const User = require('../../../models/User');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS } = require('../../../config/constants');

const isMutuallyBlocked = async (userA, userB) => {
  const [aBlocksB, bBlocksA] = await Promise.all([
    User.exists({ _id: userA, blockedUsers: userB }),
    User.exists({ _id: userB, blockedUsers: userA }),
  ]);
  return !!(aBlocksB || bBlocksA);
};

const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

const follow = async (followerId, targetId) => {
  if (followerId.toString() === targetId.toString()) {
    throw new AppError('You cannot follow yourself', HTTP_STATUS.BAD_REQUEST);
  }

  const target = await User.findById(targetId).select('_id deletedAt');
  if (!target || target.deletedAt) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  if (await isMutuallyBlocked(followerId, targetId)) {
    throw new AppError('Unable to follow this user', HTTP_STATUS.FORBIDDEN);
  }

  try {
    await Follower.create({ followerId, followingId: targetId });
  } catch (err) {
    if (err.code === 11000) throw new AppError('You are already following this user', HTTP_STATUS.CONFLICT);
    throw err;
  }

  await Promise.all([
    User.findByIdAndUpdate(targetId, { $inc: { followersCount: 1 } }),
    User.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } }),
  ]);

  return { message: 'Followed successfully' };
};

const unfollow = async (followerId, targetId) => {
  if (followerId.toString() === targetId.toString()) {
    throw new AppError('You cannot unfollow yourself', HTTP_STATUS.BAD_REQUEST);
  }

  const removed = await Follower.findOneAndDelete({ followerId, followingId: targetId });
  if (!removed) throw new AppError('You are not following this user', HTTP_STATUS.NOT_FOUND);

  await Promise.all([
    User.findByIdAndUpdate(targetId, { $inc: { followersCount: -1 } }),
    User.findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } }),
  ]);

  return { message: 'Unfollowed successfully' };
};

const getFollowers = async (userId, query) => {
  const { page, limit, skip } = parsePagination(query);

  const [docs, total] = await Promise.all([
    Follower.find({ followingId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'followerId', select: 'username displayName avatarUrl followersCount', match: { deletedAt: null } }),
    Follower.countDocuments({ followingId: userId }),
  ]);

  return {
    users: docs.map((d) => d.followerId).filter(Boolean),
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
};

const getFollowing = async (userId, query) => {
  const { page, limit, skip } = parsePagination(query);

  const [docs, total] = await Promise.all([
    Follower.find({ followerId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'followingId', select: 'username displayName avatarUrl followersCount', match: { deletedAt: null } }),
    Follower.countDocuments({ followerId: userId }),
  ]);

  return {
    users: docs.map((d) => d.followingId).filter(Boolean),
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
};

const isFollowing = async (followerId, followingId) =>
  !!(await Follower.exists({ followerId, followingId }));

module.exports = { follow, unfollow, getFollowers, getFollowing, isFollowing };
