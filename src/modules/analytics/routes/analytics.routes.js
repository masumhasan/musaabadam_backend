const { Router } = require('express');
const { query } = require('express-validator');
const { authenticateUser, requireRole, authenticateAdmin } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { ROLES } = require('../../../config/constants');
const { adminOverview, adminRevenueTrend, sellerOverview, sellerRevenueTrend, adminUsersTrend, adminStreamsTrend } = require('../controllers/analytics.controller');

const router = Router();

const queryValidator = [
  query('days').optional({ values: 'falsy' }).isInt({ min: 1, max: 365 }).withMessage('days must be between 1 and 365'),
  query('timeframe').optional().isIn(['daily', 'weekly', 'monthly', 'yearly', 'lifetime']).withMessage('Invalid timeframe'),
  validate,
];

// Seller analytics
router.get('/seller/overview', authenticateUser, requireRole(ROLES.SELLER), sellerOverview);
router.get('/seller/revenue', authenticateUser, requireRole(ROLES.SELLER), ...queryValidator, sellerRevenueTrend);

// Admin analytics
router.get('/admin/overview', authenticateAdmin, ...queryValidator, adminOverview);
router.get('/admin/revenue', authenticateAdmin, ...queryValidator, adminRevenueTrend);
router.get('/admin/users-trend', authenticateAdmin, ...queryValidator, adminUsersTrend);
router.get('/admin/streams-trend', authenticateAdmin, ...queryValidator, adminStreamsTrend);

module.exports = router;
