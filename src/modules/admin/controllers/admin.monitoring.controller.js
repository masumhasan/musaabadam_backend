const Order = require('../../../models/Order');
const Payout = require('../../../models/Payout');
const Stream = require('../../../models/Stream');
const { success } = require('../../../utils/apiResponse');

const paginate = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

// GET /admin/orders — platform-wide order monitoring.
const listOrders = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
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
    const [payouts, total] = await Promise.all([
      Payout.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('sellerId', 'username displayName'),
      Payout.countDocuments(filter),
    ]);
    return success(res, { payouts, total, page, limit, totalPages: Math.ceil(total / limit) }, 'Payouts');
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

module.exports = { listOrders, listPayouts, listStreams, terminateStream };
