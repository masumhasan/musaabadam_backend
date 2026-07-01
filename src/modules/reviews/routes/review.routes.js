const { Router } = require('express');
const { body, param, query } = require('express-validator');
const { authenticateUser } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const ctrl = require('../controllers/review.controller');

const router = Router();

// Buyer: orders awaiting a review (declare before /:sellerId to avoid capture).
router.get('/reviewable', authenticateUser, ctrl.reviewable);

// Buyer submits a review for a delivered order.
router.post(
  '/',
  authenticateUser,
  body('orderId').isMongoId().withMessage('Invalid order ID'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('rating must be 1–5'),
  body('comment').optional({ values: 'falsy' }).isString().trim().isLength({ max: 1000 }),
  validate,
  ctrl.create
);

// Public: a seller's reviews + rating summary.
router.get(
  '/seller/:sellerId',
  authenticateUser,
  param('sellerId').isMongoId().withMessage('Invalid seller ID'),
  query('page').optional({ values: 'falsy' }).isInt({ min: 1 }),
  query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 50 }),
  validate,
  ctrl.listForSeller
);

module.exports = router;
