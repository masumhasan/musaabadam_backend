const { Router } = require('express');
const { authenticateUser, requireRole } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { ROLES } = require('../../../config/constants');
const ctrl = require('../controllers/shipping.controller');
const {
  profileIdParam,
  profileBodyValidator,
  updateProfileValidator,
  estimateValidator,
  labelValidator,
  orderIdParam,
} = require('../validators/shipping.validators');

const router = Router();
const isSeller = requireRole(ROLES.SELLER);

// ── Shipping profiles (seller) ───────────────────────────────────────────────
router.get('/profiles', authenticateUser, isSeller, ctrl.listProfiles);
router.post('/profiles', authenticateUser, isSeller, ...profileBodyValidator, validate, ctrl.createProfile);
router.patch('/profiles/:profileId', authenticateUser, isSeller, ...updateProfileValidator, validate, ctrl.updateProfile);
router.delete('/profiles/:profileId', authenticateUser, isSeller, ...profileIdParam, validate, ctrl.removeProfile);

// ── Rate estimate (any authed user) ──────────────────────────────────────────
router.get('/estimate/:productId', authenticateUser, ...estimateValidator, validate, ctrl.estimate);

// ── Labels & tracking ────────────────────────────────────────────────────────
router.post('/orders/:orderId/label', authenticateUser, isSeller, ...labelValidator, validate, ctrl.generateLabel);
router.get('/orders/:orderId/track', authenticateUser, ...orderIdParam, validate, ctrl.track);

module.exports = router;
