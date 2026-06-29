const auctionService = require('../modules/auctions/services/auction.service');
const Product = require('../models/Product');
const { LISTING_TYPES, PRODUCT_STATUS } = require('../config/constants');
const logger = require('../utils/logger');

// In-memory auction close scheduler. Each live auction has at most one pending
// timer keyed by productId. Anti-snipe extensions reschedule the same key.
// NOTE: timers live in-process; a server restart drops them. A periodic sweep
// (closing auctions whose auctionEndsAt has passed) can back this up later.

let _io = null;
const timers = new Map(); // productId(string) -> NodeJS.Timeout

const setIO = (io) => {
  _io = io;
};

const clearAuctionTimer = (productId) => {
  const key = String(productId);
  const t = timers.get(key);
  if (t) {
    clearTimeout(t);
    timers.delete(key);
  }
};

const fireClose = async (productId) => {
  clearAuctionTimer(productId);
  try {
    const result = await auctionService.closeAuction(productId);
    if (result && _io && result.streamId) {
      _io.to(`stream:${result.streamId}`).emit('auction-closed', result);
    }
  } catch (err) {
    logger.error('Auction auto-close failed', { productId: String(productId), error: err.message });
  }
};

// Schedule (or reschedule) the close of an auction at endsAt.
const scheduleAuctionClose = (productId, endsAt) => {
  clearAuctionTimer(productId);
  const ms = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const t = setTimeout(() => fireClose(productId), ms);
  timers.set(String(productId), t);
};

// Safety-net sweep: close any live auction whose end time has passed but which
// has no in-memory timer (e.g. after a server restart, or auctions whose window
// was set at listing time rather than via startAuction).
const sweepExpiredAuctions = async () => {
  try {
    const expired = await Product.find({
      deletedAt: null,
      listingType: LISTING_TYPES.AUCTION,
      status: PRODUCT_STATUS.ACTIVE,
      auctionEndsAt: { $ne: null, $lte: new Date() },
    }).select('_id');

    for (const p of expired) {
      const key = String(p._id);
      if (!timers.has(key)) await fireClose(p._id);
    }
  } catch (err) {
    logger.error('Auction sweep failed', { error: err.message });
  }
};

let sweepInterval = null;
const startSweeper = (intervalMs = 15000) => {
  if (sweepInterval) return;
  sweepInterval = setInterval(sweepExpiredAuctions, intervalMs);
  if (sweepInterval.unref) sweepInterval.unref();
};

module.exports = { setIO, scheduleAuctionClose, clearAuctionTimer, startSweeper, sweepExpiredAuctions };
