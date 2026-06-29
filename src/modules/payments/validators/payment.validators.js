const { param, body, query } = require('express-validator');

const orderIdParam = [param('orderId').isMongoId().withMessage('Invalid order ID')];
const methodIdParam = [param('methodId').isMongoId().withMessage('Invalid payment method ID')];

const addMethodValidator = [
  body('providerPaymentMethodId').optional({ values: 'falsy' }).isString().trim(),
  body('card').optional({ values: 'falsy' }).isObject(),
  body('card.number').optional({ values: 'falsy' }).isString().trim(),
  body('card.brand').optional({ values: 'falsy' }).isString().trim(),
  body('card.expMonth').optional({ values: 'falsy' }).isInt({ min: 1, max: 12 }),
  body('card.expYear').optional({ values: 'falsy' }).isInt({ min: 2024, max: 2100 }),
  body('makeDefault').optional({ values: 'falsy' }).isBoolean(),
];

const checkoutValidator = [
  ...orderIdParam,
  body('paymentMethodId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid payment method ID'),
];

const refundValidator = [
  ...orderIdParam,
  body('amount').optional({ values: 'falsy' }).isFloat({ gt: 0 }).withMessage('amount must be > 0'),
  body('reason').optional({ values: 'falsy' }).isString().trim().isLength({ max: 300 }),
];

const payoutValidator = [
  body('amount').optional({ values: 'falsy' }).isFloat({ gt: 0 }).withMessage('amount must be > 0'),
  body('destination').optional({ values: 'falsy' }).isString().trim(),
];

const paginationValidator = [
  query('page').optional({ values: 'falsy' }).isInt({ min: 1 }),
  query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 50 }),
];

module.exports = {
  orderIdParam,
  methodIdParam,
  addMethodValidator,
  checkoutValidator,
  refundValidator,
  payoutValidator,
  paginationValidator,
};
