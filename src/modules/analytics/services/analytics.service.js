const mongoose = require('mongoose');
const User = require('../../../models/User');
const Stream = require('../../../models/Stream');
const Order = require('../../../models/Order');
const Product = require('../../../models/Product');
const Tip = require('../../../models/Tip');

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

const getTimeframeFilter = (timeframe) => {
  if (!timeframe || timeframe === 'lifetime') return null;
  const now = new Date();
  const start = new Date();
  if (timeframe === 'daily') {
    start.setHours(0, 0, 0, 0); // start of today
  } else if (timeframe === 'weekly') {
    start.setDate(now.getDate() - 7);
  } else if (timeframe === 'monthly') {
    start.setMonth(now.getMonth() - 1);
  } else if (timeframe === 'yearly') {
    start.setFullYear(now.getFullYear() - 1);
  } else {
    return null;
  }
  return { $gte: start };
};

const getAdminOverview = async (query = {}) => {
  const timeframe = query.timeframe;
  const tfFilter = getTimeframeFilter(timeframe);

  const userMatch = { deletedAt: null };
  const sellerMatch = { role: 'seller', deletedAt: null };
  const streamMatch = { deletedAt: null };
  const orderMatch = {};
  const revenueMatch = { status: { $in: ['delivered', 'shipped'] }, isPaid: true };

  if (tfFilter) {
    userMatch.createdAt = tfFilter;
    sellerMatch.createdAt = tfFilter;
    streamMatch.createdAt = tfFilter;
    orderMatch.createdAt = tfFilter;
    revenueMatch.createdAt = tfFilter;
  }

  const [
    totalUsers,
    totalSellers,
    totalStreams,
    liveStreams,
    totalOrders,
    revenueResult,
    recentOrders,
  ] = await Promise.all([
    User.countDocuments(userMatch),
    User.countDocuments(sellerMatch),
    Stream.countDocuments(streamMatch),
    Stream.countDocuments({ status: 'live', deletedAt: null }), // Keep "Live Now" real-time status-based
    Order.countDocuments(orderMatch),
    Order.aggregate([
      { $match: revenueMatch },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Order.find(orderMatch)
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

const getAdminRevenueTrend = async (query = {}) => {
  const timeframe = query.timeframe || 'monthly';
  const tfFilter = getTimeframeFilter(timeframe);

  const match = { isPaid: true };
  if (tfFilter) {
    match.createdAt = tfFilter;
  } else if (query.days) {
    const since = new Date();
    since.setDate(since.getDate() - Number(query.days));
    match.createdAt = { $gte: since };
  } else {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    match.createdAt = { $gte: since };
  }

  let format = '%Y-%m-%d';
  if (timeframe === 'daily') {
    format = '%Y-%m-%dT%H:00:00.000';
  } else if (timeframe === 'yearly' || timeframe === 'lifetime') {
    format = '%Y-%m-01';
  }

  return Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format, date: '$createdAt' } },
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

const getSellerOverview = async (sellerId) => {
  const sellerOid = toObjectId(sellerId);

  const [totalOrders, pendingOrders, revenueResult, totalProducts, activeProducts, streamStats, tipsResult] = await Promise.all([
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
    Tip.aggregate([
      { $match: { sellerId: sellerOid, status: 'succeeded' } },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 },
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
    tipsAmount: tipsResult[0]?.total ?? 0,
    tipsCount: tipsResult[0]?.count ?? 0,
  };
};

const getSellerRevenueTrend = async (sellerId, { days = 30 } = {}) => {
  const sellerOid = toObjectId(sellerId);
  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  const [ordersTrend, tipsTrend] = await Promise.all([
    Order.aggregate([
      { $match: { sellerId: sellerOid, createdAt: { $gte: since }, isPaid: true } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
        },
      },
    ]),
    Tip.aggregate([
      { $match: { sellerId: sellerOid, createdAt: { $gte: since }, status: 'succeeded' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          tipsAmount: { $sum: '$amount' },
          tipsCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  const trendMap = {};

  ordersTrend.forEach(item => {
    trendMap[item._id] = {
      _id: item._id,
      revenue: item.revenue,
      orders: item.orders,
      tipsAmount: 0,
      tipsCount: 0,
    };
  });

  tipsTrend.forEach(item => {
    if (!trendMap[item._id]) {
      trendMap[item._id] = {
        _id: item._id,
        revenue: 0,
        orders: 0,
        tipsAmount: item.tipsAmount,
        tipsCount: item.tipsCount,
      };
    } else {
      trendMap[item._id].tipsAmount = item.tipsAmount;
      trendMap[item._id].tipsCount = item.tipsCount;
    }
  });

  return Object.values(trendMap).sort((a, b) => a._id.localeCompare(b._id));
};

const getUsersTrend = async (query = {}) => {
  const timeframe = query.timeframe || 'monthly';
  const tfFilter = getTimeframeFilter(timeframe);

  const match = { deletedAt: null };
  if (tfFilter) {
    match.createdAt = tfFilter;
  } else if (query.days) {
    const since = new Date();
    since.setDate(since.getDate() - Number(query.days));
    match.createdAt = { $gte: since };
  } else {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    match.createdAt = { $gte: since };
  }

  let format = '%Y-%m-%d';
  if (timeframe === 'daily') {
    format = '%Y-%m-%dT%H:00:00.000';
  } else if (timeframe === 'yearly' || timeframe === 'lifetime') {
    format = '%Y-%m-01';
  }

  return User.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format, date: '$createdAt' } },
        newUsers: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

const getStreamsTrend = async (query = {}) => {
  const timeframe = query.timeframe || 'monthly';
  const tfFilter = getTimeframeFilter(timeframe);

  const match = { deletedAt: null };
  if (tfFilter) {
    match.createdAt = tfFilter;
  } else if (query.days) {
    const since = new Date();
    since.setDate(since.getDate() - Number(query.days));
    match.createdAt = { $gte: since };
  } else {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    match.createdAt = { $gte: since };
  }

  let format = '%Y-%m-%d';
  if (timeframe === 'daily') {
    format = '%Y-%m-%dT%H:00:00.000';
  } else if (timeframe === 'yearly' || timeframe === 'lifetime') {
    format = '%Y-%m-01';
  }

  return Stream.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format, date: '$createdAt' } },
        newStreams: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

module.exports = { getAdminOverview, getAdminRevenueTrend, getSellerOverview, getSellerRevenueTrend, getUsersTrend, getStreamsTrend };
