const { Router } = require('express');
const { query } = require('express-validator');
const { authenticateUser, requireRole, authenticateAdmin } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { ROLES } = require('../../../config/constants');
const { adminOverview, adminRevenueTrend, sellerOverview, sellerRevenueTrend, adminUsersTrend, adminStreamsTrend } = require('../controllers/analytics.controller');

const router = Router();

const daysValidator = [
  query('days').optional({ values: 'falsy' }).isInt({ min: 1, max: 365 }).withMessage('days must be between 1 and 365'),
  validate,
];

// Seller analytics
router.get('/seller/overview', authenticateUser, requireRole(ROLES.SELLER), sellerOverview);
router.get('/seller/revenue', authenticateUser, requireRole(ROLES.SELLER), ...daysValidator, sellerRevenueTrend);

// Admin analytics
router.get('/admin/overview', authenticateAdmin, adminOverview);
router.get('/admin/revenue', authenticateAdmin, ...daysValidator, adminRevenueTrend);
router.get('/admin/users-trend', authenticateAdmin, ...daysValidator, adminUsersTrend);
router.get('/admin/streams-trend', authenticateAdmin, ...daysValidator, adminStreamsTrend);

module.exports = router;
