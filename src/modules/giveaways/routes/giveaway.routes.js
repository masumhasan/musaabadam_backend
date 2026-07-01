const { Router } = require('express');
const { body, param } = require('express-validator');
const { authenticateUser, requireRole } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { ROLES } = require('../../../config/constants');
const { GIVEAWAY_RESTRICTION } = require('../../../models/Giveaway');
const ctrl = require('../controllers/giveaway.controller');

const router = Router();
const isSeller = requireRole(ROLES.SELLER);
const idParam = [param('giveawayId').isMongoId().withMessage('Invalid giveaway ID')];

// Seller controls
router.post(
  '/',
  authenticateUser,
  isSeller,
  body('title').isString().trim().isLength({ min: 1, max: 120 }).withMessage('title is required'),
  body('streamId').optional({ values: 'falsy' }).isMongoId(),
  body('productId').optional({ values: 'falsy' }).isMongoId(),
  body('restriction').optional({ values: 'falsy' }).isIn(Object.values(GIVEAWAY_RESTRICTION)),
  validate,
  ctrl.create
);
router.post('/:giveawayId/draw', authenticateUser, isSeller, ...idParam, validate, ctrl.draw);
router.post('/:giveawayId/cancel', authenticateUser, isSeller, ...idParam, validate, ctrl.cancel);

// Viewer
router.post('/:giveawayId/join', authenticateUser, ...idParam, validate, ctrl.join);
router.get(
  '/stream/:streamId',
  authenticateUser,
  param('streamId').isMongoId().withMessage('Invalid stream ID'),
  validate,
  ctrl.streamGiveaways
);

module.exports = router;
