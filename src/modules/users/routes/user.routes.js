const express = require('express');
const { body, param } = require('express-validator');
const userController = require('../controllers/user.controller');
const followController = require('../controllers/follow.controller');
const { authenticateUser } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');

const router = express.Router();

router.use(authenticateUser);

// ─── Seller Application ───────────────────────────────────────────────────────

router.post('/seller-application', [
  body('primaryCategory').trim().notEmpty().withMessage('Primary category is required'),
  body('subcategories').optional().isArray(),
  body('subcategories.*').optional().isString().trim(),
  body('sellerType').isIn(['starting', 'active']).withMessage('sellerType must be starting or active'),
  body('businessAddress.fullName').trim().notEmpty().withMessage('Full name is required'),
  body('businessAddress.line1').trim().notEmpty().withMessage('Address line 1 is required'),
  body('businessAddress.city').trim().notEmpty().withMessage('City is required'),
  body('businessAddress.postalCode').trim().notEmpty().withMessage('Postal code is required'),
  body('businessAddress.country').trim().notEmpty().withMessage('Country is required'),
  body('averageEarningRange').trim().notEmpty().withMessage('Average earning range is required'),
], validate, userController.applyAsSeller);

// ─── Own profile ──────────────────────────────────────────────────────────────

router.get('/profile', userController.getMyProfile);

// Referral code + invite stats (must precede the /:userId catch-all below)
router.get('/referral', userController.getReferralInfo);

router.put('/profile', [
  body('displayName').optional().trim().isLength({ max: 60 }).withMessage('Display name too long'),
  body('bio').optional().trim().isLength({ max: 300 }).withMessage('Bio too long'),
  body('location').optional().trim().isLength({ max: 100 }),
], validate, userController.updateMyProfile);

// ─── Addresses ────────────────────────────────────────────────────────────────

const addressBodyValidators = [
  body('type').optional().isIn(['shipping', 'pickup']).withMessage('type must be shipping or pickup'),
  body('label').optional().trim().isLength({ max: 50 }),
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('line1').trim().notEmpty().withMessage('Address line 1 is required'),
  body('line2').optional().trim(),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('state').optional().trim(),
  body('postalCode').trim().notEmpty().withMessage('Postal code is required'),
  body('country').trim().notEmpty().withMessage('Country is required'),
  body('phone').optional().trim(),
  body('isDefault').optional().isBoolean(),
];

router.get('/addresses', userController.getAddresses);

router.post('/addresses', addressBodyValidators, validate, userController.addAddress);

router.put('/addresses/:addressId', [
  param('addressId').isMongoId().withMessage('Invalid address ID'),
  ...addressBodyValidators,
], validate, userController.updateAddress);

router.delete('/addresses/:addressId', [
  param('addressId').isMongoId().withMessage('Invalid address ID'),
], validate, userController.deleteAddress);

// ─── Notification preferences ─────────────────────────────────────────────────

router.put('/notification-preferences', userController.updateNotificationPreferences);

// ─── Block list (own) ─────────────────────────────────────────────────────────

router.get('/blocked', followController.getBlockedUsers);

// ─── Follow / Unfollow ────────────────────────────────────────────────────────

const userIdParam = [param('userId').isMongoId().withMessage('Invalid user ID')];

router.post('/:userId/follow', userIdParam, validate, followController.followUser);
router.delete('/:userId/follow', userIdParam, validate, followController.unfollowUser);
router.get('/:userId/followers', userIdParam, validate, followController.getFollowers);
router.get('/:userId/following', userIdParam, validate, followController.getFollowing);

// ─── Block / Unblock ──────────────────────────────────────────────────────────

router.post('/:userId/block', userIdParam, validate, followController.blockUser);
router.delete('/:userId/block', userIdParam, validate, followController.unblockUser);

// ─── Public profile (keep last — catch-all for /:userId) ─────────────────────

router.get('/:userId', userIdParam, validate, userController.getPublicProfile);

module.exports = router;
