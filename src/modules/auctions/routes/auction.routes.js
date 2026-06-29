const { Router } = require('express');
const { authenticateUser, requireRole } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { ROLES } = require('../../../config/constants');
const ctrl = require('../controllers/auction.controller');
const {
  startAuctionValidator,
  placeBidValidator,
  bidHistoryValidator,
  productIdParam,
} = require('../validators/auction.validators');

const router = Router();
const isSeller = requireRole(ROLES.SELLER);

// Seller controls
router.post('/start', authenticateUser, isSeller, ...startAuctionValidator, validate, ctrl.startAuction);
router.post('/:productId/close', authenticateUser, isSeller, ...productIdParam, validate, ctrl.closeAuction);

// Bidding (REST fallback — primary path is the socket)
router.post('/:productId/bids', authenticateUser, ...placeBidValidator, validate, ctrl.placeBid);
router.get('/:productId/bids', authenticateUser, ...bidHistoryValidator, validate, ctrl.bidHistory);

module.exports = router;
