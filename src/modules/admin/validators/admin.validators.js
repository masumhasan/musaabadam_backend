const { body, param, query } = require('express-validator');
const { ADMIN_ROLES, ADMIN_PERMISSIONS, ROLES } = require('../../../config/constants');

const loginValidator = [
  body('email').isEmail().customSanitizer((v) => v.toLowerCase().trim()).withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

const adminForgotPasswordValidator = [
  body('email').isEmail().customSanitizer((v) => v.toLowerCase().trim()).withMessage('Valid email required'),
];

const adminVerifyResetOtpValidator = [
  body('email').isEmail().customSanitizer((v) => v.toLowerCase().trim()).withMessage('Valid email required'),
  body('otp').trim().matches(/^\d{6}$/).withMessage('OTP must be a 6-digit number'),
];

const adminResetPasswordValidator = [
  body('resetToken').trim().notEmpty().withMessage('Reset session token is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
];

const userIdParam = [
  param('userId').isMongoId().withMessage('Invalid user ID'),
];

const adminIdParam = [
  param('adminId').isMongoId().withMessage('Invalid admin ID'),
];

const suspendValidator = [
  ...userIdParam,
  body('reason').trim().notEmpty().withMessage('Suspension reason required').isLength({ max: 500 }),
  body('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be 1–365').toInt(),
];

const banValidator = [
  ...userIdParam,
  body('reason').trim().notEmpty().withMessage('Ban reason required').isLength({ max: 500 }),
];

const rejectSellerValidator = [
  ...userIdParam,
  body('reason').trim().notEmpty().withMessage('Rejection reason required').isLength({ max: 1000 }),
];

const requestInfoValidator = [
  ...userIdParam,
  body('note').trim().notEmpty().withMessage('Note required').isLength({ max: 1000 }),
];

const listUsersValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('role').optional({ values: 'falsy' }).isIn(Object.values(ROLES)),
  query('status').optional({ values: 'falsy' }).isIn(['active', 'banned', 'inactive']),
  query('search').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
];

const listSellersValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional({ values: 'falsy' }).isIn(['pending', 'approved', 'rejected', 'suspended', 'needs_more_information']),
];

const createAdminValidator = [
  body('email').isEmail().customSanitizer((v) => v.toLowerCase().trim()).withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().notEmpty().isLength({ max: 50 }),
  body('lastName').trim().notEmpty().isLength({ max: 50 }),
  body('role').isIn(Object.values(ADMIN_ROLES)).withMessage('Invalid role'),
  body('permissions').optional().isArray(),
  body('permissions.*').optional().isIn(Object.values(ADMIN_PERMISSIONS)),
];

const categoryIdParam = [
  param('categoryId').isMongoId().withMessage('Invalid category ID'),
];

const createCategoryValidator = [
  body('name').trim().notEmpty().withMessage('Name required').isLength({ max: 80 }),
  body('slug').optional({ values: 'falsy' }).trim().matches(/^[a-z0-9-]+$/).withMessage('Slug may only contain lowercase letters, numbers, and hyphens').isLength({ max: 80 }),
  body('parentId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid parent category ID'),
  body('imageUrl').optional({ values: 'falsy' }).trim().isURL().withMessage('imageUrl must be a valid URL').isLength({ max: 500 }),
  body('sortOrder').optional().isInt({ min: 0 }).toInt().withMessage('sortOrder must be a non-negative integer'),
];

const updateCategoryValidator = [
  ...categoryIdParam,
  body('name').optional({ values: 'falsy' }).trim().notEmpty().isLength({ max: 80 }),
  body('slug').optional({ values: 'falsy' }).trim().matches(/^[a-z0-9-]+$/).withMessage('Slug may only contain lowercase letters, numbers, and hyphens').isLength({ max: 80 }),
  body('parentId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid parent category ID'),
  body('imageUrl').optional({ values: 'falsy' }).trim().isURL().withMessage('imageUrl must be a valid URL').isLength({ max: 500 }),
  body('isActive').optional().isBoolean().toBoolean(),
  body('sortOrder').optional().isInt({ min: 0 }).toInt().withMessage('sortOrder must be a non-negative integer'),
];

const listCategoriesValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  query('parentId').optional({ values: 'falsy' }).custom((v) => v === 'null' || /^[a-f\d]{24}$/i.test(v)).withMessage('parentId must be a valid MongoDB ObjectId or "null"'),
];

const { LISTING_TYPES, PRODUCT_STATUS } = require('../../../config/constants');

const productIdParam = [
  param('productId').isMongoId().withMessage('Invalid product ID'),
];

const listProductsAdminValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional({ values: 'falsy' }).isIn(Object.values(PRODUCT_STATUS)),
  query('listingType').optional({ values: 'falsy' }).isIn(Object.values(LISTING_TYPES)),
  query('sellerId').optional({ values: 'falsy' }).isMongoId(),
  query('search').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
];

module.exports = {
  loginValidator,
  adminForgotPasswordValidator,
  adminVerifyResetOtpValidator,
  adminResetPasswordValidator,
  userIdParam,
  adminIdParam,
  suspendValidator,
  banValidator,
  rejectSellerValidator,
  requestInfoValidator,
  listUsersValidator,
  listSellersValidator,
  createAdminValidator,
  categoryIdParam,
  createCategoryValidator,
  updateCategoryValidator,
  listCategoriesValidator,
  productIdParam,
  listProductsAdminValidator,
};
