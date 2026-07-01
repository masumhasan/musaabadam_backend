const { Router } = require('express');
const { authenticateUser, requireRole } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { ROLES } = require('../../../config/constants');
const ctrl = require('../controllers/order.controller');
const {
  orderIdParam,
  createOrderValidator,
  updateStatusValidator,
  cancelOrderValidator,
  listOrdersValidator,
} = require('../validators/order.validators');

const router = Router();
const isSeller = requireRole(ROLES.SELLER);

// Buyer routes
router.post('/', authenticateUser, ...createOrderValidator, validate, ctrl.create);
router.get('/my', authenticateUser, ...listOrdersValidator, validate, ctrl.myOrders);
router.post('/:orderId/cancel', authenticateUser, ...cancelOrderValidator, validate, ctrl.cancel);
router.post('/:orderId/complete', authenticateUser, ...orderIdParam, validate, ctrl.complete);
router.patch('/:orderId/address', authenticateUser, ...orderIdParam, validate, ctrl.setAddress);

// Seller routes — must be before /:orderId to avoid param capture issues
router.get('/seller', authenticateUser, isSeller, ...listOrdersValidator, validate, ctrl.sellerOrders);
router.patch('/:orderId/status', authenticateUser, isSeller, ...updateStatusValidator, validate, ctrl.updateStatus);

// Shared: buyer or seller can view their own order
router.get('/:orderId', authenticateUser, ...orderIdParam, validate, ctrl.detail);

module.exports = router;
