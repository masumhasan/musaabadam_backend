const { Router } = require('express');
const { query } = require('express-validator');
const { authenticateUser } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const ctrl = require('../controllers/search.controller');

const router = Router();

router.get(
  '/',
  authenticateUser,
  query('q').isString().trim().isLength({ min: 1, max: 100 }).withMessage('q is required'),
  query('type').optional({ values: 'falsy' }).isIn(['all', 'sellers', 'products', 'streams']),
  query('filter').optional({ values: 'falsy' }).isIn(['live', 'upcoming', 'ended', 'auction', 'buy_now']),
  query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 50 }),
  validate,
  ctrl.search
);

module.exports = router;
