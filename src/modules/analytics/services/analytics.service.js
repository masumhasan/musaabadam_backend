const mongoose = require('mongoose');
const User = require('../../../models/User');
const Stream = require('../../../models/Stream');
const Order = require('../../../models/Order');
const Product = require('../../../models/Product');

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

const getAdminOverview = async () => {
  const [
    totalUsers,
    totalSellers,
    totalStreams,
    liveStreams,
    totalOrders,
    revenueResult,
    recentOrders,
  ] = await Promise.all([
    User.countDocuments({ deletedAt: null }),
    User.countDocuments({ role: 'seller', deletedAt: null }),
    Stream.countDocuments({ deletedAt: null }),
    Stream.countDocuments({ status: 'live', deletedAt: null }),
    Order.countDocuments({}),
    Order.aggregate([
      { $match: { status: { $in: ['delivered', 'shipped'] }, isPaid: true } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Order.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('buyerId', 'username displayName avatarUrl')
      .populate('sellerId', 'username displayName avatarUrl'),
  ]);

  return {
    totalUsers,
    totalSellers,
    totalStreams,
    liveStreams,
    totalOrders,
    totalRevenue: revenueResult[0]?.total ?? 0,
    recentOrders,
  };
};

const getAdminRevenueTrend = async ({ days = 30 } = {}) => {
  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  return Order.aggregate([
    { $match: { createdAt: { $gte: since }, isPaid: true } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

const getSellerOverview = async (sellerId) => {
  const sellerOid = toObjectId(sellerId);

  const [totalOrders, pendingOrders, revenueResult, totalProducts, activeProducts, streamStats] = await Promise.all([
    Order.countDocuments({ sellerId: sellerOid }),
    Order.countDocuments({ sellerId: sellerOid, status: 'pending' }),
    Order.aggregate([
      { $match: { sellerId: sellerOid, status: { $in: ['delivered', 'shipped'] }, isPaid: true } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Product.countDocuments({ sellerId, deletedAt: null }),
    Product.countDocuments({ sellerId, status: 'active', deletedAt: null }),
    Stream.aggregate([
      { $match: { sellerId: sellerOid } },
      {
        $group: {
          _id: null,
          totalStreams: { $sum: 1 },
          totalViewers: { $sum: '$totalViewers' },
          peakViewers: { $max: '$peakViewerCount' },
        },
      },
    ]),
  ]);

  return {
    totalOrders,
    pendingOrders,
    totalRevenue: revenueResult[0]?.total ?? 0,
    totalProducts,
    activeProducts,
    streams: streamStats[0] ?? { totalStreams: 0, totalViewers: 0, peakViewers: 0 },
  };
};

const getSellerRevenueTrend = async (sellerId, { days = 30 } = {}) => {
  const sellerOid = toObjectId(sellerId);
  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  return Order.aggregate([
    { $match: { sellerId: sellerOid, createdAt: { $gte: since }, isPaid: true } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

module.exports = { getAdminOverview, getAdminRevenueTrend, getSellerOverview, getSellerRevenueTrend };
