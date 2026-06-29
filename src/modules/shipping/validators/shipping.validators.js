const { param, body, query } = require('express-validator');
const { CARRIERS } = require('../../../models/ShippingProfile');

const profileIdParam = [param('profileId').isMongoId().withMessage('Invalid profile ID')];
const orderIdParam = [param('orderId').isMongoId().withMessage('Invalid order ID')];
const productIdParam = [param('productId').isMongoId().withMessage('Invalid product ID')];

const carriers = Object.values(CARRIERS);

const profileBodyValidator = [
  body('name').isString().trim().isLength({ min: 1, max: 80 }).withMessage('name is required (max 80)'),
  body('carrier').optional({ values: 'falsy' }).isIn(carriers).withMessage('Invalid carrier'),
  body('flatRate').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('freeShippingThreshold').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('rateTiers').optional({ values: 'falsy' }).isArray(),
  body('rateTiers.*.price').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('rateTiers.*.maxWeightKg').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('handlingDays').optional({ values: 'falsy' }).isInt({ min: 0, max: 60 }),
  body('domesticOnly').optional({ values: 'falsy' }).isBoolean(),
  body('internationalRate').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('isDefault').optional({ values: 'falsy' }).isBoolean(),
];

// Independent chain instances so making fields optional here does not leak into
// the create validator (express-validator chains are mutable and shared).
const updateProfileValidator = [
  ...profileIdParam,
  body('name').optional({ values: 'falsy' }).isString().trim().isLength({ min: 1, max: 80 }),
  body('carrier').optional({ values: 'falsy' }).isIn(carriers).withMessage('Invalid carrier'),
  body('flatRate').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('freeShippingThreshold').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('rateTiers').optional({ values: 'falsy' }).isArray(),
  body('rateTiers.*.price').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('rateTiers.*.maxWeightKg').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('handlingDays').optional({ values: 'falsy' }).isInt({ min: 0, max: 60 }),
  body('domesticOnly').optional({ values: 'falsy' }).isBoolean(),
  body('internationalRate').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('isDefault').optional({ values: 'falsy' }).isBoolean(),
];

const estimateValidator = [
  ...productIdParam,
  query('subtotal').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  query('international').optional({ values: 'falsy' }).isBoolean(),
];

const labelValidator = [
  ...orderIdParam,
  body('carrier').optional({ values: 'falsy' }).isIn(carriers).withMessage('Invalid carrier'),
];

module.exports = {
  profileIdParam,
  orderIdParam,
  productIdParam,
  profileBodyValidator,
  updateProfileValidator,
  estimateValidator,
  labelValidator,
};
