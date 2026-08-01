const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/product.controller');
const { authenticateUser, requirePermission, requireApprovedSeller } = require('../../../middleware/auth');
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
router.get('/inventory', canManageProducts, requireApprovedSeller, inventoryQueryValidator, validate, controller.inventory);

// ── Public browse ─────────────────────────────────────────────────────────────
router.get('/', listProductsValidator, validate, controller.list);

// ── Create listing ────────────────────────────────────────────────────────────
router.post('/', canManageProducts, requireApprovedSeller, createProductValidator, validate, controller.create);

// ── Single product ────────────────────────────────────────────────────────────
router.get('/:productId', productIdParam, validate, controller.getOne);

// ── Update / delete (owner only) ──────────────────────────────────────────────
router.put('/:productId', canManageProducts, requireApprovedSeller, productIdParam, updateProductValidator, validate, controller.update);
router.delete('/:productId', canManageProducts, requireApprovedSeller, productIdParam, validate, controller.remove);

// ── Status transitions ────────────────────────────────────────────────────────
router.patch('/:productId/publish', canManageProducts, requireApprovedSeller, productIdParam, validate, controller.publish);
router.patch('/:productId/deactivate', canManageProducts, requireApprovedSeller, productIdParam, validate, controller.deactivate);

// ── Flash sale ─────────────────────────────────────────────────────────────────
router.post(
  '/:productId/flash-sale',
  canManageProducts,
  requireApprovedSeller,
  ...productIdParam,
  body('flashSalePrice').isFloat({ min: 0 }).withMessage('flashSalePrice must be >= 0'),
  body('durationMinutes').optional({ values: 'falsy' }).isInt({ min: 1, max: 10080 }),
  body('endsAt').optional({ values: 'falsy' }).isISO8601(),
  body('stock').optional({ values: 'falsy' }).isInt({ min: 1 }),
  validate,
  controller.startFlashSale
);
router.delete('/:productId/flash-sale', canManageProducts, requireApprovedSeller, productIdParam, validate, controller.endFlashSale);

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
