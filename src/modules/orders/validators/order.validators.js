const { param, body, query } = require('express-validator');
const { ORDER_STATUS } = require('../../../models/Order');

const orderIdParam = [param('orderId').isMongoId().withMessage('Invalid order ID')];

const createOrderValidator = [
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.productId').isMongoId().withMessage('Each item must have a valid productId'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Each item quantity must be at least 1'),
  body('shippingAddressSnapshot').optional({ values: 'falsy' }).isObject(),
  body('shippingAddressSnapshot.fullName').optional({ values: 'falsy' }).isString().trim(),
  body('shippingAddressSnapshot.line1').optional({ values: 'falsy' }).isString().trim(),
  body('shippingAddressSnapshot.city').optional({ values: 'falsy' }).isString().trim(),
  body('shippingAddressSnapshot.postalCode').optional({ values: 'falsy' }).isString().trim(),
  body('shippingAddressSnapshot.country').optional({ values: 'falsy' }).isString().trim(),
  body('streamId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid streamId'),
  body('notes').optional({ values: 'falsy' }).isString().trim().isLength({ max: 500 }),
];

const updateStatusValidator = [
  ...orderIdParam,
  body('status')
    .isIn([
      ORDER_STATUS.CONFIRMED,
      ORDER_STATUS.PROCESSING,
      ORDER_STATUS.SHIPPED,
      ORDER_STATUS.DELIVERED,
      ORDER_STATUS.CANCELLED,
    ])
    .withMessage('Invalid status'),
  body('trackingNumber').optional({ values: 'falsy' }).isString().trim(),
  body('trackingCarrier').optional({ values: 'falsy' }).isString().trim(),
  body('cancelReason').optional({ values: 'falsy' }).isString().trim(),
];

const cancelOrderValidator = [
  ...orderIdParam,
  body('cancelReason').optional({ values: 'falsy' }).isString().trim(),
];

const listOrdersValidator = [
  query('status').optional({ values: 'falsy' }).isIn(Object.values(ORDER_STATUS)).withMessage('Invalid status'),
  query('page').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50'),
];

module.exports = {
  orderIdParam,
  createOrderValidator,
  updateStatusValidator,
  cancelOrderValidator,
  listOrdersValidator,
};
