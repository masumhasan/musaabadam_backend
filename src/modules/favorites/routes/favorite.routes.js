const { Router } = require('express');
const { param, query } = require('express-validator');
const { authenticateUser } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const ctrl = require('../controllers/favorite.controller');

const router = Router();

router.get(
  '/',
  authenticateUser,
  query('page').optional({ values: 'falsy' }).isInt({ min: 1 }),
  query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 50 }),
  validate,
  ctrl.list
);

router.post(
  '/:productId',
  authenticateUser,
  param('productId').isMongoId().withMessage('Invalid product ID'),
  validate,
  ctrl.toggle
);

module.exports = router;
