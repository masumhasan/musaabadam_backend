const { Router } = require('express');
const { authenticateUser, requireRole } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { ROLES } = require('../../../config/constants');
const ctrl = require('../controllers/payment.controller');
const {
  methodIdParam,
  addMethodValidator,
  checkoutValidator,
  refundValidator,
  payoutValidator,
  paginationValidator,
} = require('../validators/payment.validators');

const router = Router();
const isSeller = requireRole(ROLES.SELLER);

// ── Payment methods (buyer) ──────────────────────────────────────────────────
router.get('/methods', authenticateUser, ctrl.listMethods);
router.post('/methods', authenticateUser, ...addMethodValidator, validate, ctrl.addMethod);
router.delete('/methods/:methodId', authenticateUser, ...methodIdParam, validate, ctrl.removeMethod);

// ── Checkout / escrow ────────────────────────────────────────────────────────
router.post('/orders/:orderId/checkout', authenticateUser, ...checkoutValidator, validate, ctrl.checkout);
router.post('/orders/:orderId/confirm', authenticateUser, ...checkoutValidator, validate, ctrl.confirm);
router.post('/orders/:orderId/refund', authenticateUser, isSeller, ...refundValidator, validate, ctrl.refund);

// ── Wallet ───────────────────────────────────────────────────────────────────
router.get('/wallet', authenticateUser, ctrl.wallet);
router.get('/wallet/ledger', authenticateUser, ...paginationValidator, validate, ctrl.ledger);

// ── Payouts (seller) ─────────────────────────────────────────────────────────
router.get('/payouts', authenticateUser, isSeller, ...paginationValidator, validate, ctrl.listPayouts);
router.post('/payouts', authenticateUser, isSeller, ...payoutValidator, validate, ctrl.requestPayout);

module.exports = router;
