const Reward = require('../../../models/Reward');
const User = require('../../../models/User');
const crypto = require('crypto');
const { HTTP_STATUS } = require('../../../config/constants');
const AppError = require('../../../utils/AppError');

// Get current user's rewards
const listRewards = async (req, res, next) => {
  try {
    const rewards = await Reward.find({ userId: req.user._id, isUsed: false }).sort({ expiresAt: 1 });
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { rewards },
      message: 'Active rewards retrieved',
    });
  } catch (err) {
    next(err);
  }
};

// Claim a coupon for completing a challenge
const claimChallengeReward = async (req, res, next) => {
  try {
    const { challengeId } = req.body;
    if (!challengeId) {
      throw new AppError('Challenge ID is required', HTTP_STATUS.BAD_REQUEST);
    }

    // Check if they already claimed this challenge to avoid double claims
    const claimCode = `CHALLENGE-${challengeId.toUpperCase()}-${req.user._id.toString().slice(-4)}`;
    const existing = await Reward.findOne({ code: claimCode });
    if (existing) {
      throw new AppError('You have already claimed this challenge reward.', HTTP_STATUS.BAD_REQUEST);
    }

    // Award a £10 fixed discount coupon expiring in 7 days
    const reward = await Reward.create({
      userId: req.user._id,
      code: claimCode,
      title: `Challenge reward: ${challengeId.replace(/_/g, ' ')}`,
      discountType: 'fixed',
      discountValue: 10,
      minOrderValue: 15, // minimum order of £15 to apply
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    });

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: { reward },
      message: 'Challenge reward claimed successfully!',
    });
  } catch (err) {
    next(err);
  }
};

// Admin: List all rewards in system
const adminListRewards = async (req, res, next) => {
  try {
    const rewards = await Reward.find({}).populate('userId', 'username email').sort({ createdAt: -1 });
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { rewards },
      message: 'All rewards retrieved',
    });
  } catch (err) {
    next(err);
  }
};

// Admin: Create reward coupon
const adminCreateReward = async (req, res, next) => {
  try {
    const { username, title, discountType, discountValue, minOrderValue, expiresDays } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const code = 'REWARD-' + crypto.randomBytes(3).toString('hex').toUpperCase();

    const reward = await Reward.create({
      userId: user._id,
      code,
      title,
      discountType: discountType || 'fixed',
      discountValue: Number(discountValue),
      minOrderValue: Number(minOrderValue || 0),
      expiresAt: new Date(Date.now() + Number(expiresDays || 30) * 24 * 60 * 60 * 1000),
    });

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: { reward },
      message: 'Reward coupon issued successfully',
    });
  } catch (err) {
    next(err);
  }
};

// Admin: Revoke/delete reward coupon
const adminDeleteReward = async (req, res, next) => {
  try {
    const reward = await Reward.findByIdAndDelete(req.params.id);
    if (!reward) {
      throw new AppError('Reward not found', HTTP_STATUS.NOT_FOUND);
    }
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: null,
      message: 'Reward coupon revoked successfully',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listRewards,
  claimChallengeReward,
  adminListRewards,
  adminCreateReward,
  adminDeleteReward,
};
