const { Router } = require('express');
const { body, param, query } = require('express-validator');
const { authenticateUser, authenticateAdmin, requireAdminPermission } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { ADMIN_PERMISSIONS } = require('../../../config/constants');
const { REPORT_TARGET, REPORT_REASON, REPORT_STATUS } = require('../../../models/Report');
const ctrl = require('../controllers/report.controller');

const router = Router();

// ── User: file a report ──
router.post(
  '/',
  authenticateUser,
  body('targetType').isIn(Object.values(REPORT_TARGET)).withMessage('Invalid target type'),
  body('targetId').isMongoId().withMessage('Invalid target ID'),
  body('reason').isIn(Object.values(REPORT_REASON)).withMessage('Invalid reason'),
  body('details').optional({ values: 'falsy' }).isString().trim().isLength({ max: 1000 }),
  validate,
  ctrl.create
);

// ── Admin: review + resolve ──
router.get(
  '/',
  authenticateAdmin,
  requireAdminPermission(ADMIN_PERMISSIONS.VIEW_REPORTS),
  query('status').optional({ values: 'falsy' }).isIn(Object.values(REPORT_STATUS)),
  query('page').optional({ values: 'falsy' }).isInt({ min: 1 }),
  query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 50 }),
  validate,
  ctrl.list
);

router.get('/stats', authenticateAdmin, requireAdminPermission(ADMIN_PERMISSIONS.VIEW_REPORTS), ctrl.stats);

router.patch(
  '/:reportId',
  authenticateAdmin,
  requireAdminPermission(ADMIN_PERMISSIONS.VIEW_REPORTS),
  param('reportId').isMongoId(),
  body('status').isIn(Object.values(REPORT_STATUS)).withMessage('Invalid status'),
  body('resolutionNote').optional({ values: 'falsy' }).isString().trim().isLength({ max: 500 }),
  validate,
  ctrl.update
);

module.exports = router;
