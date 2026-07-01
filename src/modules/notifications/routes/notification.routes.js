const { Router } = require('express');
const { param, query } = require('express-validator');
const { authenticateUser } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const ctrl = require('../controllers/notification.controller');

const router = Router();

router.get(
  '/',
  authenticateUser,
  query('page').optional({ values: 'falsy' }).isInt({ min: 1 }),
  query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 50 }),
  query('unreadOnly').optional({ values: 'falsy' }).isBoolean(),
  validate,
  ctrl.list
);

router.get('/unread-count', authenticateUser, ctrl.unreadCount);
router.post('/read-all', authenticateUser, ctrl.markAllRead);
router.patch(
  '/:notificationId/read',
  authenticateUser,
  param('notificationId').isMongoId().withMessage('Invalid notification ID'),
  validate,
  ctrl.markRead
);

module.exports = router;
