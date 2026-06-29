const { param, body, query } = require('express-validator');

const productIdParam = [param('productId').isMongoId().withMessage('Invalid product ID')];

const startAuctionValidator = [
  body('productId').isMongoId().withMessage('Invalid product ID'),
  body('streamId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid stream ID'),
  body('durationMs').optional({ values: 'falsy' }).isInt({ min: 5000, max: 3600000 }).withMessage('durationMs must be 5s–60m'),
  body('startingPrice').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('startingPrice must be >= 0'),
  body('reservePrice').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('reservePrice must be >= 0'),
];

const placeBidValidator = [
  ...productIdParam,
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than 0'),
  body('streamId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid stream ID'),
  body('isAutoBid').optional({ values: 'falsy' }).isBoolean().withMessage('isAutoBid must be a boolean'),
  body('maxAmount').optional({ values: 'falsy' }).isFloat({ gt: 0 }).withMessage('maxAmount must be greater than 0'),
];

const bidHistoryValidator = [
  ...productIdParam,
  query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 100 }).withMessage('limit must be 1–100'),
];

module.exports = { productIdParam, startAuctionValidator, placeBidValidator, bidHistoryValidator };
