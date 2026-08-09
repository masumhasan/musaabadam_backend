const Order = require('../../../models/Order');
const Payout = require('../../../models/Payout');
const Stream = require('../../../models/Stream');
const Offer = require('../../../models/Offer');
const { success } = require('../../../utils/apiResponse');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS } = require('../../../config/constants');

const paginate = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

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

// GET /admin/orders — platform-wide order monitoring.
const listOrders = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const tfFilter = getTimeframeFilter(req.query.timeframe);
    if (tfFilter) filter.createdAt = tfFilter;
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('buyerId', 'username displayName')
        .populate('sellerId', 'username displayName'),
      Order.countDocuments(filter),
    ]);
    return success(res, { orders, total, page, limit, totalPages: Math.ceil(total / limit) }, 'Orders');
  } catch (err) {
    next(err);
  }
};

// GET /admin/payouts — finance monitoring of seller payouts.
const listPayouts = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const tfFilter = getTimeframeFilter(req.query.timeframe);
    if (tfFilter) filter.createdAt = tfFilter;

    const paidMatch = { status: 'paid' };
    const pendingMatch = { status: { $in: ['pending', 'processing'] } };
    if (tfFilter) {
      paidMatch.createdAt = tfFilter;
      pendingMatch.createdAt = tfFilter;
    }

    const [payouts, total, paidResult, pendingResult] = await Promise.all([
      Payout.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('sellerId', 'username displayName'),
      Payout.countDocuments(filter),
      Payout.aggregate([
        { $match: paidMatch },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payout.aggregate([
        { $match: pendingMatch },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);
    const totalPaid = paidResult[0]?.total ?? 0;
    const totalPending = pendingResult[0]?.total ?? 0;
    return success(res, { payouts, total, totalPaid, totalPending, page, limit, totalPages: Math.ceil(total / limit) }, 'Payouts');
  } catch (err) {
    next(err);
  }
};

// GET /admin/streams — livestream monitoring (live first).
const listStreams = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = { deletedAt: null };
    if (req.query.status) filter.status = req.query.status;
    const tfFilter = getTimeframeFilter(req.query.timeframe);
    if (tfFilter) filter.createdAt = tfFilter;
    const [streams, total] = await Promise.all([
      Stream.find(filter)
        .sort({ status: 1, startedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sellerId', 'username displayName'),
      Stream.countDocuments(filter),
    ]);
    return success(res, { streams, total, page, limit, totalPages: Math.ceil(total / limit) }, 'Streams');
  } catch (err) {
    next(err);
  }
};

// PATCH /admin/streams/:streamId/terminate — force-end a live stream.
const terminateStream = async (req, res, next) => {
  try {
    const stream = await Stream.findById(req.params.streamId);
    if (!stream) return success(res, null, 'Stream not found');
    stream.status = 'ended';
    stream.endedAt = new Date();
    await stream.save();
    return success(res, { stream }, 'Stream terminated');
  } catch (err) {
    next(err);
  }
};

// GET /admin/offers — platform-wide offer monitoring.
const listOffers = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const tfFilter = getTimeframeFilter(req.query.timeframe);
    if (tfFilter) filter.createdAt = tfFilter;
    const [offers, total] = await Promise.all([
      Offer.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('buyerId', 'username displayName')
        .populate('sellerId', 'username displayName')
        .populate('productId', 'title price images'),
      Offer.countDocuments(filter),
    ]);
    return success(res, { offers, total, page, limit, totalPages: Math.ceil(total / limit) }, 'Offers');
  } catch (err) {
    next(err);
  }
};

// GET /admin/tips — platform-wide tip monitoring.
const listTips = async (req, res, next) => {
  try {
    const Tip = require('../../../models/Tip');
    const { page, limit, skip } = paginate(req.query);
    const filter = {};
    const tfFilter = getTimeframeFilter(req.query.timeframe);
    if (tfFilter) filter.createdAt = tfFilter;

    const tipsMatch = { status: 'succeeded' };
    if (tfFilter) {
      tipsMatch.createdAt = tfFilter;
    }

    const [tips, total, totalAmountResult] = await Promise.all([
      Tip.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('buyerId', 'username displayName email')
        .populate('sellerId', 'username displayName email'),
      Tip.countDocuments(filter),
      Tip.aggregate([
        { $match: tipsMatch },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);
    const totalAmount = totalAmountResult[0]?.total ?? 0;
    return success(res, { tips, total, totalAmount, page, limit, totalPages: Math.ceil(total / limit) }, 'Tips');
  } catch (err) {
    next(err);
  }
};

// PATCH /admin/streams/:streamId — admin edit any livestream.
const updateStream = async (req, res, next) => {
  try {
    const stream = await Stream.findOne({ _id: req.params.streamId, deletedAt: null });
    if (!stream) throw new AppError('Stream not found', HTTP_STATUS.NOT_FOUND);

    const { title, description, status } = req.body;
    
    if (title !== undefined) stream.title = title;
    if (description !== undefined) stream.description = description;
    if (status !== undefined) stream.status = status;

    await stream.save();
    return success(res, { stream }, 'Stream updated successfully');
  } catch (err) {
    next(err);
  }
};

// DELETE /admin/streams/:streamId — admin delete any livestream.
const deleteStream = async (req, res, next) => {
  try {
    const stream = await Stream.findOne({ _id: req.params.streamId, deletedAt: null });
    if (!stream) throw new AppError('Stream not found', HTTP_STATUS.NOT_FOUND);

    stream.deletedAt = new Date();
    await stream.save();
    return success(res, { id: String(stream._id) }, 'Stream deleted successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listOrders,
  listPayouts,
  listStreams,
  terminateStream,
  listOffers,
  listTips,
  updateStream,
  deleteStream,
};
