const Bid = require('../../../models/Bid');
const { BID_STATUS } = require('../../../models/Bid');
const Product = require('../../../models/Product');
const Order = require('../../../models/Order');
const { ORDER_STATUS } = require('../../../models/Order');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS, LISTING_TYPES, PRODUCT_STATUS, AUCTION } = require('../../../config/constants');

// ─── Helpers ────────────────────────────────────────────────────────────────

const currentFloor = (product) => product.currentHighBid || product.startingPrice || 0;

const incrementOf = (product) => product.bidIncrement || AUCTION.MIN_INCREMENT;

const publicProductState = (product) => ({
  productId: String(product._id),
  streamId: product.streamId ? String(product.streamId) : null,
  currentHighBid: product.currentHighBid,
  highestBidderId: product.highestBidderId ? String(product.highestBidderId) : null,
  startingPrice: product.startingPrice,
  reservePrice: product.reservePrice,
  auctionEndsAt: product.auctionEndsAt,
  auctionState: product.auctionState,
  bidIncrement: incrementOf(product),
  status: product.status,
});

// Resolve standing auto-bids: after a bid lands, let other bidders' proxy bids
// respond automatically up to their max. Bounded to avoid runaway loops.
const resolveAutoBids = async (product) => {
  const increment = incrementOf(product);
  for (let i = 0; i < 20; i += 1) {
    const floor = currentFloor(product);
    // Highest standing auto-bid from someone who is NOT already the leader and
    // whose ceiling can still beat the current high.
    const contender = await Bid.findOne({
      productId: product._id,
      isAutoBid: true,
      status: BID_STATUS.ACTIVE,
      bidderId: { $ne: product.highestBidderId },
      maxAmount: { $gt: floor + increment - 0.0001 },
    }).sort({ maxAmount: -1, createdAt: 1 });

    if (!contender) break;

    const nextAmount = Math.min(contender.maxAmount, floor + increment);

    await Bid.updateMany(
      { productId: product._id, status: BID_STATUS.ACTIVE },
      { $set: { status: BID_STATUS.OUTBID } }
    );

    const proxyBid = await Bid.create({
      productId: product._id,
      streamId: product.streamId,
      bidderId: contender.bidderId,
      amount: nextAmount,
      maxAmount: contender.maxAmount,
      isAutoBid: true,
      status: BID_STATUS.ACTIVE,
    });

    product.currentHighBid = nextAmount;
    product.highestBidderId = contender.bidderId;
    await product.save();

    // The standing auto-bid row is now reflected by proxyBid; the old one is outbid.
    if (!proxyBid) break;
  }
};

// ─── Public API ─────────────────────────────────────────────────────────────

// Seller starts (or restarts) a live auction on a product pinned to a stream.
const startAuction = async (sellerId, { productId, streamId, durationMs, startingPrice, reservePrice, bidIncrement }) => {
  const product = await Product.findOne({ _id: productId, deletedAt: null });
  if (!product) throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
  if (!product.sellerId.equals(sellerId)) throw new AppError('Not authorized', HTTP_STATUS.FORBIDDEN);
  if (product.listingType !== LISTING_TYPES.AUCTION) {
    throw new AppError('Product is not an auction listing', HTTP_STATUS.CONFLICT);
  }

  const ends = new Date(Date.now() + (Number(durationMs) || AUCTION.DEFAULT_DURATION_MS));

  if (startingPrice != null) product.startingPrice = Number(startingPrice);
  if (reservePrice != null) product.reservePrice = Number(reservePrice);
  if (bidIncrement != null && Number(bidIncrement) > 0) product.bidIncrement = Number(bidIncrement);
  product.currentHighBid = 0;
  product.highestBidderId = null;
  product.auctionEndsAt = ends;
  product.auctionState = 'running';
  product.auctionPausedRemainingMs = undefined;
  product.status = PRODUCT_STATUS.ACTIVE;
  if (streamId) product.streamId = streamId;
  await product.save();

  // Clear stale bids from any previous round so the history is per-auction.
  await Bid.updateMany(
    { productId: product._id, status: { $in: [BID_STATUS.ACTIVE, BID_STATUS.OUTBID] } },
    { $set: { status: BID_STATUS.CANCELLED } }
  );

  return publicProductState(product);
};

const loadOwnedAuction = async (sellerId, productId) => {
  const product = await Product.findOne({ _id: productId, deletedAt: null });
  if (!product) throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
  if (!product.sellerId.equals(sellerId)) throw new AppError('Not authorized', HTTP_STATUS.FORBIDDEN);
  if (product.listingType !== LISTING_TYPES.AUCTION) {
    throw new AppError('Product is not an auction listing', HTTP_STATUS.CONFLICT);
  }
  return product;
};

// Pause a running auction: freeze the remaining time so it can be resumed.
const pauseAuction = async (sellerId, productId) => {
  const product = await loadOwnedAuction(sellerId, productId);
  if (product.auctionState !== 'running') {
    throw new AppError('Auction is not running', HTTP_STATUS.CONFLICT);
  }
  const remainingMs = Math.max(0, new Date(product.auctionEndsAt).getTime() - Date.now());
  product.auctionState = 'paused';
  product.auctionPausedRemainingMs = remainingMs;
  await product.save();
  return { ...publicProductState(product), remainingMs };
};

// Resume a paused auction: restore the remaining time from where it stopped.
const resumeAuction = async (sellerId, productId) => {
  const product = await loadOwnedAuction(sellerId, productId);
  if (product.auctionState !== 'paused') {
    throw new AppError('Auction is not paused', HTTP_STATUS.CONFLICT);
  }
  const remainingMs = product.auctionPausedRemainingMs || AUCTION.DEFAULT_DURATION_MS;
  product.auctionEndsAt = new Date(Date.now() + remainingMs);
  product.auctionState = 'running';
  product.auctionPausedRemainingMs = undefined;
  await product.save();
  return publicProductState(product);
};

// Cancel an auction outright: no winner, no order. Voids outstanding bids.
const cancelAuction = async (sellerId, productId) => {
  const product = await loadOwnedAuction(sellerId, productId);
  if (['none'].includes(product.auctionState) && product.status !== PRODUCT_STATUS.ACTIVE) {
    throw new AppError('No active auction to cancel', HTTP_STATUS.CONFLICT);
  }
  await Bid.updateMany(
    { productId: product._id, status: { $in: [BID_STATUS.ACTIVE, BID_STATUS.OUTBID] } },
    { $set: { status: BID_STATUS.CANCELLED } }
  );
  product.auctionState = 'none';
  product.auctionEndsAt = null;
  product.currentHighBid = 0;
  product.highestBidderId = null;
  product.auctionPausedRemainingMs = undefined;
  product.status = PRODUCT_STATUS.ENDED;
  await product.save();
  return { ...publicProductState(product), cancelled: true };
};

// Place a (manual or auto) bid. Returns the leading state plus whether the
// timer was extended by anti-snipe protection.
const placeBid = async (bidderId, { productId, streamId, amount, maxAmount, isAutoBid }) => {
  const bidAmount = parseFloat(amount);
  if (Number.isNaN(bidAmount) || bidAmount <= 0) {
    throw new AppError('Invalid bid amount', HTTP_STATUS.BAD_REQUEST);
  }

  const product = await Product.findOne({ _id: productId, deletedAt: null });
  if (!product) throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
  if (product.listingType !== LISTING_TYPES.AUCTION) {
    throw new AppError('Product is not an auction listing', HTTP_STATUS.CONFLICT);
  }
  if (product.sellerId.equals(bidderId)) {
    throw new AppError('Sellers cannot bid on their own auction', HTTP_STATUS.FORBIDDEN);
  }
  if (product.auctionState === 'paused') {
    throw new AppError('Auction is paused', HTTP_STATUS.CONFLICT);
  }
  if (!product.auctionEndsAt || new Date() > new Date(product.auctionEndsAt)) {
    throw new AppError('Auction has ended', HTTP_STATUS.GONE);
  }

  const floor = currentFloor(product);
  const minRequired = floor + incrementOf(product);
  if (bidAmount < minRequired) {
    throw new AppError(`Bid must be at least $${minRequired.toFixed(2)}`, HTTP_STATUS.CONFLICT);
  }
  if (isAutoBid && maxAmount != null && Number(maxAmount) < bidAmount) {
    throw new AppError('Max auto-bid must be greater than or equal to the bid amount', HTTP_STATUS.BAD_REQUEST);
  }

  // Demote the prior leader.
  await Bid.updateMany(
    { productId: product._id, status: BID_STATUS.ACTIVE },
    { $set: { status: BID_STATUS.OUTBID } }
  );

  const bid = await Bid.create({
    productId: product._id,
    streamId: streamId ?? product.streamId,
    bidderId,
    amount: bidAmount,
    maxAmount: isAutoBid ? Number(maxAmount ?? bidAmount) : undefined,
    isAutoBid: Boolean(isAutoBid),
    status: BID_STATUS.ACTIVE,
  });

  product.currentHighBid = bidAmount;
  product.highestBidderId = bidderId;

  // Anti-snipe: a bid in the final window pushes the close time out.
  const msLeft = new Date(product.auctionEndsAt).getTime() - Date.now();
  let extended = false;
  if (msLeft <= AUCTION.ANTI_SNIPE_WINDOW_MS) {
    product.auctionEndsAt = new Date(Date.now() + AUCTION.ANTI_SNIPE_EXTENSION_MS);
    extended = true;
  }
  await product.save();

  // Let competing auto-bids respond.
  await resolveAutoBids(product);

  const leader = await Bid.findOne({ productId: product._id, status: BID_STATUS.ACTIVE })
    .populate('bidderId', 'username displayName avatarUrl');

  const bidCount = await Bid.countDocuments({
    productId: product._id,
    status: { $in: [BID_STATUS.ACTIVE, BID_STATUS.OUTBID, BID_STATUS.WON, BID_STATUS.LOST] },
  });

  return {
    bidId: String(bid._id),
    ...publicProductState(product),
    bidCount,
    extended,
    leadingBidder: leader?.bidderId
      ? {
          userId: String(leader.bidderId._id),
          username: leader.bidderId.username,
          displayName: leader.bidderId.displayName || leader.bidderId.username,
          avatarUrl: leader.bidderId.avatarUrl ?? null,
        }
      : null,
  };
};

// Close an auction: pick the winner if the reserve was met, create an order,
// and settle bid statuses. Idempotent-ish — returns null if already closed.
const closeAuction = async (productId) => {
  const product = await Product.findOne({ _id: productId, deletedAt: null });
  if (!product) return null;
  if (product.status === PRODUCT_STATUS.SOLD_OUT || product.status === PRODUCT_STATUS.ENDED) return null;

  const leader = await Bid.findOne({ productId: product._id, status: BID_STATUS.ACTIVE })
    .populate('bidderId', 'username displayName avatarUrl');

  const reserve = product.reservePrice || 0;
  const reserveMet = leader && leader.amount >= reserve;

  if (leader && reserveMet) {
    leader.status = BID_STATUS.WON;
    await leader.save();
    await Bid.updateMany(
      { productId: product._id, _id: { $ne: leader._id }, status: { $in: [BID_STATUS.ACTIVE, BID_STATUS.OUTBID] } },
      { $set: { status: BID_STATUS.LOST } }
    );

    product.status = PRODUCT_STATUS.SOLD_OUT;
    product.quantitySold = Math.min(product.quantity, (product.quantitySold || 0) + 1);
    product.auctionEndsAt = product.auctionEndsAt || new Date();
    product.auctionState = 'none';
    await product.save();

    // Pending order for the winner — paid via the payments pillar at checkout.
    const order = await Order.create({
      buyerId: leader.bidderId._id,
      sellerId: product.sellerId,
      streamId: product.streamId ?? null,
      items: [
        {
          productId: product._id,
          title: product.title,
          imageUrl: product.images?.[0] ?? null,
          quantity: 1,
          unitPrice: leader.amount,
          totalPrice: leader.amount,
        },
      ],
      subtotal: leader.amount,
      shippingCost: 0,
      taxAmount: 0,
      totalAmount: leader.amount,
      status: ORDER_STATUS.PENDING,
    });

    return {
      ...publicProductState(product),
      sold: true,
      reserveMet: true,
      orderId: String(order._id),
      winner: {
        userId: String(leader.bidderId._id),
        username: leader.bidderId.username,
        displayName: leader.bidderId.displayName || leader.bidderId.username,
        avatarUrl: leader.bidderId.avatarUrl ?? null,
      },
      winningAmount: leader.amount,
    };
  }

  // No qualifying bid — mark all bids lost and end the auction unsold.
  await Bid.updateMany(
    { productId: product._id, status: { $in: [BID_STATUS.ACTIVE, BID_STATUS.OUTBID] } },
    { $set: { status: BID_STATUS.LOST } }
  );
  product.status = PRODUCT_STATUS.ENDED;
  product.auctionState = 'none';
  await product.save();

  return {
    ...publicProductState(product),
    sold: false,
    reserveMet: false,
    winner: null,
  };
};

const getBidHistory = async (productId, { limit = 30 } = {}) => {
  const bids = await Bid.find({
    productId,
    status: { $ne: BID_STATUS.CANCELLED },
  })
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .populate('bidderId', 'username displayName avatarUrl');

  return bids.map((b) => ({
    id: String(b._id),
    amount: b.amount,
    isAutoBid: b.isAutoBid,
    status: b.status,
    createdAt: b.createdAt,
    bidder: b.bidderId
      ? {
          userId: String(b.bidderId._id),
          username: b.bidderId.username,
          displayName: b.bidderId.displayName || b.bidderId.username,
          avatarUrl: b.bidderId.avatarUrl ?? null,
        }
      : null,
  }));
};

module.exports = {
  startAuction,
  pauseAuction,
  resumeAuction,
  cancelAuction,
  placeBid,
  closeAuction,
  getBidHistory,
  publicProductState,
};
