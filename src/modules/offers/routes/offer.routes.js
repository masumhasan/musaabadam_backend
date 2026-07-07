const { Router } = require('express');
const { body, param, query } = require('express-validator');
const { authenticateUser } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const ctrl = require('../controllers/offer.controller');
const { OFFER_STATUS } = require('../../../models/Offer');

const router = Router();

router.use(authenticateUser);

router.post(
  '/',
  body('productId').isMongoId().withMessage('Invalid product ID'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be at least 0.01'),
  validate,
  ctrl.create
);

router.get(
  '/buyer',
  query('page').optional({ values: 'falsy' }).isInt({ min: 1 }),
  query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 50 }),
  validate,
  ctrl.buyerOffers
);

router.get(
  '/seller',
  query('page').optional({ values: 'falsy' }).isInt({ min: 1 }),
  query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 50 }),
  validate,
  ctrl.sellerOffers
);

router.patch(
  '/:offerId/status',
  param('offerId').isMongoId().withMessage('Invalid offer ID'),
  body('status').isIn(Object.values(OFFER_STATUS)).withMessage('Invalid status'),
  validate,
  ctrl.updateStatus
);

module.exports = router;
