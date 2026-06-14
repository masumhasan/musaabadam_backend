const followService = require('../services/follow.service');
const blockService = require('../services/block.service');
const { success } = require('../../../utils/apiResponse');

const followUser = async (req, res, next) => {
  try {
    const result = await followService.follow(req.user._id, req.params.userId);
    return success(res, null, result.message);
  } catch (err) { next(err); }
};

const unfollowUser = async (req, res, next) => {
  try {
    const result = await followService.unfollow(req.user._id, req.params.userId);
    return success(res, null, result.message);
  } catch (err) { next(err); }
};

const getFollowers = async (req, res, next) => {
  try {
    const data = await followService.getFollowers(req.params.userId, req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getFollowing = async (req, res, next) => {
  try {
    const data = await followService.getFollowing(req.params.userId, req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const blockUser = async (req, res, next) => {
  try {
    const result = await blockService.block(req.user._id, req.params.userId);
    return success(res, null, result.message);
  } catch (err) { next(err); }
};

const unblockUser = async (req, res, next) => {
  try {
    const result = await blockService.unblock(req.user._id, req.params.userId);
    return success(res, null, result.message);
  } catch (err) { next(err); }
};

const getBlockedUsers = async (req, res, next) => {
  try {
    const data = await blockService.getBlockedUsers(req.user._id, req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

module.exports = { followUser, unfollowUser, getFollowers, getFollowing, blockUser, unblockUser, getBlockedUsers };
