const { success, created } = require('../../../utils/apiResponse');
const svc = require('../services/auction.service');
const { getIO } = require('../../../socket');
const { scheduleAuctionClose, clearAuctionTimer } = require('../../../socket/auctionTimers');

// Seller starts a live auction on one of their products.
const startAuction = async (req, res, next) => {
  try {
    const state = await svc.startAuction(req.user._id, { ...req.body });
    // Schedule the automatic close, then broadcast to everyone watching.
    scheduleAuctionClose(state.productId, state.auctionEndsAt);
    if (state.streamId) getIO()?.to(`stream:${state.streamId}`).emit('auction-started', state);
    return created(res, { auction: state }, 'Auction started');
  } catch (err) {
    next(err);
  }
};

// REST fallback for placing a bid (the primary path is the socket).
const placeBid = async (req, res, next) => {
  try {
    const update = await svc.placeBid(req.user._id, {
      productId: req.params.productId,
      ...req.body,
    });
    if (update.extended && update.auctionEndsAt) scheduleAuctionClose(req.params.productId, update.auctionEndsAt);
    if (update.streamId) getIO()?.to(`stream:${update.streamId}`).emit('bid-updated', update);
    return created(res, { bid: update }, 'Bid placed');
  } catch (err) {
    next(err);
  }
};

// Seller manually closes an auction early.
const closeAuction = async (req, res, next) => {
  try {
    clearAuctionTimer(req.params.productId);
    const result = await svc.closeAuction(req.params.productId);
    if (result?.streamId) getIO()?.to(`stream:${result.streamId}`).emit('auction-closed', result);
    return success(res, { result }, 'Auction closed');
  } catch (err) {
    next(err);
  }
};

const bidHistory = async (req, res, next) => {
  try {
    const bids = await svc.getBidHistory(req.params.productId, req.query);
    return success(res, { bids }, 'Bid history');
  } catch (err) {
    next(err);
  }
};

module.exports = { startAuction, placeBid, closeAuction, bidHistory };
