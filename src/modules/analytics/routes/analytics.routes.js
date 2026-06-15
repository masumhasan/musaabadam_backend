const { Router } = require('express');
const { query } = require('express-validator');
const { authenticateUser, requireRole, authenticateAdmin } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { ROLES } = require('../../../config/constants');
const ctrl = require('../controllers/analytics.controller');

const router = Router();

const daysValidator = [
  query('days').optional({ values: 'falsy' }).isInt({ min: 1, max: 365 }).withMessage('days must be between 1 and 365'),
  validate,
];

// Seller analytics
router.get('/seller/overview', authenticateUser, requireRole(ROLES.SELLER), ctrl.sellerOverview);
router.get('/seller/revenue', authenticateUser, requireRole(ROLES.SELLER), ...daysValidator, ctrl.sellerRevenueTrend);

// Admin analytics
router.get('/admin/overview', authenticateAdmin, ctrl.adminOverview);
router.get('/admin/revenue', authenticateAdmin, ...daysValidator, ctrl.adminRevenueTrend);

module.exports = router;
