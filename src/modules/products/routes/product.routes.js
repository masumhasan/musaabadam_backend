const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/product.controller');
const { authenticateUser, requirePermission } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const {
  productIdParam,
  createProductValidator,
  updateProductValidator,
  listProductsValidator,
  inventoryQueryValidator,
} = require('../validators/product.validators');

const router = express.Router();

router.use(authenticateUser);

const canManageProducts = requirePermission('manage_products');

// ── Seller inventory — must come before /:productId ──────────────────────────
router.get('/inventory', canManageProducts, inventoryQueryValidator, validate, controller.inventory);

// ── Public browse ─────────────────────────────────────────────────────────────
router.get('/', listProductsValidator, validate, controller.list);

// ── Create listing ────────────────────────────────────────────────────────────
router.post('/', canManageProducts, createProductValidator, validate, controller.create);

// ── Single product ────────────────────────────────────────────────────────────
router.get('/:productId', productIdParam, validate, controller.getOne);

// ── Update / delete (owner only) ──────────────────────────────────────────────
router.put('/:productId', canManageProducts, productIdParam, updateProductValidator, validate, controller.update);
router.delete('/:productId', canManageProducts, productIdParam, validate, controller.remove);

// ── Status transitions ────────────────────────────────────────────────────────
router.patch('/:productId/publish', canManageProducts, productIdParam, validate, controller.publish);
router.patch('/:productId/deactivate', canManageProducts, productIdParam, validate, controller.deactivate);

// ── Bidding ───────────────────────────────────────────────────────────────────
router.post(
  '/:productId/bid',
  requirePermission('bid'),
  ...productIdParam,
  body('amount').isFloat({ gt: 0 }).withMessage('Bid amount must be a positive number'),
  validate,
  controller.bid
);

module.exports = router;
