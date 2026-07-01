const mongoose = require('mongoose');
const Review = require('../../../models/Review');
const Order = require('../../../models/Order');
const { ORDER_STATUS } = require('../../../models/Order');
const User = require('../../../models/User');
const notificationService = require('../../notifications/services/notification.service');
const { NOTIFICATION_TYPE } = require('../../../models/Notification');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS } = require('../../../config/constants');

// Recompute a seller's averageRating + ratingCount from live reviews.
const recomputeSellerRating = async (sellerId) => {
  const [agg] = await Review.aggregate([
    { $match: { sellerId: new mongoose.Types.ObjectId(String(sellerId)), deletedAt: null } },
    { $group: { _id: '$sellerId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const averageRating = agg ? Math.round(agg.avg * 10) / 10 : 0;
  const ratingCount = agg ? agg.count : 0;
  await User.updateOne({ _id: sellerId }, { $set: { averageRating, ratingCount } });
  return { averageRating, ratingCount };
};

// Buyer leaves a review for a delivered/completed order they own.
const createReview = async (buyerId, { orderId, rating, comment }) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  if (!order.buyerId.equals(buyerId)) throw new AppError('Not authorized', HTTP_STATUS.FORBIDDEN);
  if (![ORDER_STATUS.DELIVERED, ORDER_STATUS.COMPLETED].includes(order.status)) {
    throw new AppError('You can review only delivered orders', HTTP_STATUS.CONFLICT);
  }

  const buyer = await User.findById(buyerId).select('username displayName avatarUrl');

  let review;
  try {
    review = await Review.create({
      sellerId: order.sellerId,
      buyerId,
      orderId,
      rating: Number(rating),
      comment: comment ?? null,
      buyerName: buyer?.displayName || buyer?.username,
      buyerAvatarUrl: buyer?.avatarUrl ?? null,
    });
  } catch (err) {
    if (err.code === 11000) throw new AppError('You already reviewed this order', HTTP_STATUS.CONFLICT);
    throw err;
  }

  const { averageRating, ratingCount } = await recomputeSellerRating(order.sellerId);

  notificationService.notify(order.sellerId, {
    type: NOTIFICATION_TYPE.SYSTEM,
    title: 'New review',
    body: `${buyer?.displayName || buyer?.username || 'A buyer'} rated you ${rating}★`,
    actor: buyer
      ? { userId: String(buyer._id), displayName: buyer.displayName || buyer.username, avatarUrl: buyer.avatarUrl }
      : null,
  });

  return { review, sellerRating: { averageRating, ratingCount } };
};

const listSellerReviews = async (sellerId, { page = 1, limit = 20 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);
  const [reviews, total, seller] = await Promise.all([
    Review.find({ sellerId, deletedAt: null }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Review.countDocuments({ sellerId, deletedAt: null }),
    User.findById(sellerId).select('averageRating ratingCount'),
  ]);
  return {
    reviews: reviews.map((r) => ({
      id: String(r._id),
      rating: r.rating,
      comment: r.comment,
      buyer: { displayName: r.buyerName, avatarUrl: r.buyerAvatarUrl ?? null },
      sellerReply: r.sellerReply ?? null,
      createdAt: r.createdAt,
    })),
    averageRating: seller?.averageRating ?? 0,
    ratingCount: seller?.ratingCount ?? 0,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  };
};

// Which of the buyer's orders are still awaiting a review (delivered/completed, no review yet).
const getReviewableOrders = async (buyerId) => {
  const orders = await Order.find({
    buyerId,
    status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.COMPLETED] },
  })
    .select('items sellerId status createdAt')
    .populate('sellerId', 'username displayName avatarUrl');

  const reviewed = new Set(
    (await Review.find({ buyerId, deletedAt: null }).select('orderId')).map((r) => String(r.orderId))
  );

  return orders
    .filter((o) => !reviewed.has(String(o._id)))
    .map((o) => ({
      orderId: String(o._id),
      title: o.items?.[0]?.title ?? 'Order',
      imageUrl: o.items?.[0]?.imageUrl ?? null,
      seller: o.sellerId
        ? { userId: String(o.sellerId._id), displayName: o.sellerId.displayName || o.sellerId.username }
        : null,
    }));
};

module.exports = { createReview, listSellerReviews, getReviewableOrders, recomputeSellerRating };
