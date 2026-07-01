const Giveaway = require('../../../models/Giveaway');
const { GIVEAWAY_STATUS, GIVEAWAY_RESTRICTION } = require('../../../models/Giveaway');
const GiveawayEntry = require('../../../models/GiveawayEntry');
const Follower = require('../../../models/Follower');
const Order = require('../../../models/Order');
const { ORDER_STATUS } = require('../../../models/Order');
const Product = require('../../../models/Product');
const User = require('../../../models/User');
const notificationService = require('../../notifications/services/notification.service');
const { NOTIFICATION_TYPE } = require('../../../models/Notification');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS } = require('../../../config/constants');

const publicGiveaway = (g) => ({
  id: String(g._id),
  streamId: g.streamId ? String(g.streamId) : null,
  productId: g.productId ? String(g.productId) : null,
  title: g.title,
  restriction: g.restriction,
  status: g.status,
  entryCount: g.entryCount,
  winner: g.winnerId ? { userId: String(g.winnerId), displayName: g.winnerName } : null,
});

// Seller creates a giveaway (typically during a live stream).
const createGiveaway = async (sellerId, { streamId, productId, title, restriction }) => {
  if (productId) {
    const product = await Product.findOne({ _id: productId, deletedAt: null });
    if (!product || !product.sellerId.equals(sellerId)) {
      throw new AppError('Prize product not found', HTTP_STATUS.NOT_FOUND);
    }
  }
  const giveaway = await Giveaway.create({
    sellerId,
    streamId: streamId ?? null,
    productId: productId ?? null,
    title,
    restriction: restriction || GIVEAWAY_RESTRICTION.EVERYONE,
  });
  return publicGiveaway(giveaway);
};

const assertEligible = async (giveaway, userId) => {
  if (String(giveaway.sellerId) === String(userId)) {
    throw new AppError('Sellers cannot enter their own giveaway', HTTP_STATUS.FORBIDDEN);
  }
  if (giveaway.restriction === GIVEAWAY_RESTRICTION.FOLLOWERS) {
    const follows = await Follower.exists({ followerId: userId, followingId: giveaway.sellerId });
    if (!follows) throw new AppError('Only followers can enter this giveaway', HTTP_STATUS.FORBIDDEN);
  }
  if (giveaway.restriction === GIVEAWAY_RESTRICTION.BUYERS) {
    const bought = await Order.exists({ buyerId: userId, sellerId: giveaway.sellerId, isPaid: true });
    if (!bought) throw new AppError('Only past buyers can enter this giveaway', HTTP_STATUS.FORBIDDEN);
  }
};

// A viewer enters a giveaway (idempotent per user).
const joinGiveaway = async (userId, giveawayId) => {
  const giveaway = await Giveaway.findById(giveawayId);
  if (!giveaway) throw new AppError('Giveaway not found', HTTP_STATUS.NOT_FOUND);
  if (giveaway.status !== GIVEAWAY_STATUS.OPEN) throw new AppError('Giveaway is closed', HTTP_STATUS.CONFLICT);

  await assertEligible(giveaway, userId);

  const user = await User.findById(userId).select('username displayName');
  try {
    await GiveawayEntry.create({ giveawayId, userId, userName: user?.displayName || user?.username });
    giveaway.entryCount += 1;
    await giveaway.save();
  } catch (err) {
    if (err.code === 11000) throw new AppError('You already joined this giveaway', HTTP_STATUS.CONFLICT);
    throw err;
  }

  return publicGiveaway(giveaway);
};

// Seller draws a random winner; creates a prize order (if a product) + notifies.
const drawWinner = async (sellerId, giveawayId) => {
  const giveaway = await Giveaway.findById(giveawayId);
  if (!giveaway) throw new AppError('Giveaway not found', HTTP_STATUS.NOT_FOUND);
  if (!giveaway.sellerId.equals(sellerId)) throw new AppError('Not authorized', HTTP_STATUS.FORBIDDEN);
  if (giveaway.status !== GIVEAWAY_STATUS.OPEN) throw new AppError('Giveaway already drawn', HTTP_STATUS.CONFLICT);

  const count = await GiveawayEntry.countDocuments({ giveawayId });
  if (count === 0) throw new AppError('No entries to draw from', HTTP_STATUS.CONFLICT);

  const random = Math.floor(Math.random() * count);
  const [winnerEntry] = await GiveawayEntry.find({ giveawayId }).skip(random).limit(1);

  giveaway.status = GIVEAWAY_STATUS.DRAWN;
  giveaway.winnerId = winnerEntry.userId;
  giveaway.winnerName = winnerEntry.userName;
  giveaway.drawnAt = new Date();
  await giveaway.save();

  // If a prize product is attached, create a fully-discounted (free) prize order.
  let orderId = null;
  if (giveaway.productId) {
    const product = await Product.findById(giveaway.productId);
    if (product) {
      const order = await Order.create({
        buyerId: winnerEntry.userId,
        sellerId: giveaway.sellerId,
        streamId: giveaway.streamId ?? null,
        items: [
          {
            productId: product._id,
            title: product.title,
            imageUrl: product.images?.[0] ?? null,
            quantity: 1,
            unitPrice: 0,
            totalPrice: 0,
          },
        ],
        subtotal: 0,
        shippingCost: 0,
        taxAmount: 0,
        totalAmount: 0,
        status: ORDER_STATUS.CONFIRMED,
        isPaid: true,
        paidAt: new Date(),
        notes: `Giveaway prize: ${giveaway.title}`,
      });
      orderId = String(order._id);
    }
  }

  notificationService.notify(winnerEntry.userId, {
    type: NOTIFICATION_TYPE.GIVEAWAY_WON,
    title: 'You won a giveaway! 🎁',
    body: `You won "${giveaway.title}".`,
    data: { giveawayId: giveaway._id, orderId, streamId: giveaway.streamId ?? null },
  });

  return { ...publicGiveaway(giveaway), orderId };
};

const cancelGiveaway = async (sellerId, giveawayId) => {
  const giveaway = await Giveaway.findById(giveawayId);
  if (!giveaway) throw new AppError('Giveaway not found', HTTP_STATUS.NOT_FOUND);
  if (!giveaway.sellerId.equals(sellerId)) throw new AppError('Not authorized', HTTP_STATUS.FORBIDDEN);
  if (giveaway.status === GIVEAWAY_STATUS.DRAWN) throw new AppError('Already drawn', HTTP_STATUS.CONFLICT);
  giveaway.status = GIVEAWAY_STATUS.CANCELLED;
  await giveaway.save();
  return publicGiveaway(giveaway);
};

// Active giveaways for a stream (so a joining viewer sees them).
const getStreamGiveaways = async (streamId) => {
  const giveaways = await Giveaway.find({ streamId, status: GIVEAWAY_STATUS.OPEN }).sort({ createdAt: -1 });
  return giveaways.map(publicGiveaway);
};

module.exports = { createGiveaway, joinGiveaway, drawWinner, cancelGiveaway, getStreamGiveaways, publicGiveaway };
