const { Router } = require('express');
const { authenticateUser, requireRole } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { ROLES } = require('../../../config/constants');
const ctrl = require('../controllers/stream.controller');
const {
  streamIdParam,
  createStreamValidator,
  createAuctionValidator,
  updateStreamValidator,
  listStreamsValidator,
  sellerStreamsValidator,
} = require('../validators/stream.validators');

const router = Router();
const isSeller = requireRole(ROLES.SELLER);

// Seller-only: list own streams — declared before /:streamId to avoid param capture
router.get('/me/streams', authenticateUser, isSeller, ...sellerStreamsValidator, validate, ctrl.myStreams);

// Seller-only: create a stream
router.post('/', authenticateUser, isSeller, ...createStreamValidator, validate, ctrl.create);

// Seller-only: start an auction stream immediately (pinned product)
router.post('/auction', authenticateUser, isSeller, ...createAuctionValidator, validate, ctrl.createAuction);

// Seller-only: edit a scheduled show
router.patch('/:streamId', authenticateUser, isSeller, ...updateStreamValidator, validate, ctrl.update);

// Seller-only: lifecycle mutations
router.patch('/:streamId/start', authenticateUser, isSeller, ...streamIdParam, validate, ctrl.start);
router.patch('/:streamId/end', authenticateUser, isSeller, ...streamIdParam, validate, ctrl.end);
router.patch('/:streamId/cancel', authenticateUser, isSeller, ...streamIdParam, validate, ctrl.cancel);

// Any authenticated user: browse and join streams
router.get('/', authenticateUser, ...listStreamsValidator, validate, ctrl.list);
router.get('/:streamId', authenticateUser, ...streamIdParam, validate, ctrl.detail);
router.post('/:streamId/join', authenticateUser, ...streamIdParam, validate, ctrl.join);

module.exports = router;
