const User = require('../../../models/User');
const Follower = require('../../../models/Follower');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS } = require('../../../config/constants');

const removeFollowBothDirections = async (userA, userB) => {
  const [removedAtoB, removedBtoA] = await Promise.all([
    Follower.findOneAndDelete({ followerId: userA, followingId: userB }),
    Follower.findOneAndDelete({ followerId: userB, followingId: userA }),
  ]);

  const counterUpdates = [];
  if (removedAtoB) {
    counterUpdates.push(
      User.findByIdAndUpdate(userA, { $inc: { followingCount: -1 } }),
      User.findByIdAndUpdate(userB, { $inc: { followersCount: -1 } }),
    );
  }
  if (removedBtoA) {
    counterUpdates.push(
      User.findByIdAndUpdate(userB, { $inc: { followingCount: -1 } }),
      User.findByIdAndUpdate(userA, { $inc: { followersCount: -1 } }),
    );
  }
  if (counterUpdates.length) await Promise.all(counterUpdates);
};

const block = async (blockerId, targetId) => {
  if (blockerId.toString() === targetId.toString()) {
    throw new AppError('You cannot block yourself', HTTP_STATUS.BAD_REQUEST);
  }

  const [blocker, target] = await Promise.all([
    User.findById(blockerId).select('blockedUsers'),
    User.findById(targetId).select('_id deletedAt'),
  ]);

  if (!target || target.deletedAt) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);

  const alreadyBlocked = blocker.blockedUsers.some((id) => id.toString() === targetId.toString());
  if (alreadyBlocked) throw new AppError('User is already blocked', HTTP_STATUS.CONFLICT);

  await Promise.all([
    User.findByIdAndUpdate(blockerId, { $addToSet: { blockedUsers: targetId } }),
    removeFollowBothDirections(blockerId, targetId),
  ]);

  return { message: 'User blocked' };
};

const unblock = async (blockerId, targetId) => {
  if (blockerId.toString() === targetId.toString()) {
    throw new AppError('You cannot unblock yourself', HTTP_STATUS.BAD_REQUEST);
  }

  const blocker = await User.findByIdAndUpdate(
    blockerId,
    { $pull: { blockedUsers: targetId } },
    { new: true }
  ).select('_id');

  if (!blocker) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);

  return { message: 'User unblocked' };
};

const getBlockedUsers = async (userId, query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));

  const user = await User.findById(userId)
    .select('blockedUsers')
    .populate({
      path: 'blockedUsers',
      select: 'username displayName avatarUrl',
      match: { deletedAt: null },
      options: { skip: (page - 1) * limit, limit },
    });

  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);

  return {
    users: user.blockedUsers.filter(Boolean),
    pagination: { page, limit },
  };
};

module.exports = { block, unblock, getBlockedUsers };
