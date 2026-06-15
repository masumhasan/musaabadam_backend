const Stream = require('../../../models/Stream');
const { STREAM_STATUS } = require('../../../models/Stream');
const Product = require('../../../models/Product');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS } = require('../../../config/constants');
const { getStreamClient, generateStreamToken, upsertStreamUser } = require('../../../utils/streamClient');

const PUBLIC_SELECT = '-deletedAt -cohostIds';

const assertOwner = (stream, sellerId) => {
  if (!stream.sellerId.equals(sellerId)) {
    throw new AppError('Not authorized to modify this stream', HTTP_STATUS.FORBIDDEN);
  }
};

// ── Create ────────────────────────────────────────────────────────────────────

const createStream = async (seller, data) => {
  const callId = `stream_${seller._id}_${Date.now()}`;
  const client = getStreamClient();

  await upsertStreamUser(seller._id, seller.displayName || seller.username, seller.avatarUrl);

  const call = client.video.call('livestream', callId);
  await call.getOrCreate({
    data: {
      created_by_id: String(seller._id),
      custom: { title: data.title, sellerId: String(seller._id) },
      settings_override: {
        broadcasting: { enabled: true },
      },
    },
  });

  const stream = await Stream.create({
    sellerId: seller._id,
    title: data.title,
    description: data.description,
    categoryId: data.categoryId,
    thumbnailUrl: data.thumbnailUrl,
    tags: data.tags ?? [],
    scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
    chatEnabled: data.chatEnabled ?? true,
    callId,
    callType: 'livestream',
  });

  return stream;
};

// ── Start ─────────────────────────────────────────────────────────────────────

const startStream = async (sellerId, streamId) => {
  const stream = await Stream.findOne({ _id: streamId, deletedAt: null });
  if (!stream) throw new AppError('Stream not found', HTTP_STATUS.NOT_FOUND);
  assertOwner(stream, sellerId);

  if (stream.status === STREAM_STATUS.LIVE) throw new AppError('Stream is already live', HTTP_STATUS.CONFLICT);
  if (stream.status === STREAM_STATUS.ENDED) throw new AppError('Stream has already ended', HTTP_STATUS.CONFLICT);

  stream.status = STREAM_STATUS.LIVE;
  stream.startedAt = new Date();
  await stream.save();

  return stream;
};

// ── End ───────────────────────────────────────────────────────────────────────

const endStream = async (sellerId, streamId) => {
  const stream = await Stream.findOne({ _id: streamId, deletedAt: null });
  if (!stream) throw new AppError('Stream not found', HTTP_STATUS.NOT_FOUND);
  assertOwner(stream, sellerId);

  if (stream.status === STREAM_STATUS.ENDED) throw new AppError('Stream already ended', HTTP_STATUS.CONFLICT);

  const client = getStreamClient();
  try {
    await client.video.call(stream.callType, stream.callId).end();
  } catch {
    // GetStream call may already be ended — don't block our DB update
  }

  stream.status = STREAM_STATUS.ENDED;
  stream.endedAt = new Date();
  await stream.save();

  return stream;
};

// ── Join (get viewer token) ───────────────────────────────────────────────────

const joinStream = async (streamId, user) => {
  const stream = await Stream.findOne({ _id: streamId, deletedAt: null })
    .populate('sellerId', 'username displayName avatarUrl');
  if (!stream) throw new AppError('Stream not found', HTTP_STATUS.NOT_FOUND);
  if (stream.status === STREAM_STATUS.CANCELLED) throw new AppError('Stream was cancelled', HTTP_STATUS.GONE);

  const isSeller = stream.sellerId._id.equals(user._id);
  const role = isSeller ? 'host' : 'viewer';

  await upsertStreamUser(user._id, user.displayName || user.username, user.avatarUrl);
  const token = generateStreamToken(user._id, role);

  // Increment viewer count if viewer (not the seller)
  if (!isSeller) {
    await Stream.updateOne({ _id: streamId }, { $inc: { totalViewers: 1 } });
  }

  return {
    token,
    callId: stream.callId,
    callType: stream.callType,
    apiKey: process.env.STREAM_API_KEY,
    stream: stream.toObject(),
    role,
  };
};

// ── List public streams ───────────────────────────────────────────────────────

const getPublicStreams = async ({ status = 'live', categoryId, sellerId, page = 1, limit = 20 }) => {
  const query = { deletedAt: null, status };
  if (categoryId) query.categoryId = categoryId;
  if (sellerId) query.sellerId = sellerId;

  const skip = (Number(page) - 1) * Number(limit);
  const [streams, total] = await Promise.all([
    Stream.find(query)
      .select(PUBLIC_SELECT)
      .populate('sellerId', 'username displayName avatarUrl isSellerApproved')
      .sort(status === 'live' ? { startedAt: -1 } : { scheduledAt: 1 })
      .skip(skip)
      .limit(Number(limit)),
    Stream.countDocuments(query),
  ]);

  return { streams, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
};

// ── Seller's own streams ──────────────────────────────────────────────────────

const getSellerStreams = async (sellerId, { status, page = 1, limit = 20 }) => {
  const query = { sellerId, deletedAt: null };
  if (status) query.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [streams, total] = await Promise.all([
    Stream.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Stream.countDocuments(query),
  ]);

  return { streams, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
};

// ── Single stream ─────────────────────────────────────────────────────────────

const getStream = async (streamId) => {
  const stream = await Stream.findOne({ _id: streamId, deletedAt: null })
    .select(PUBLIC_SELECT)
    .populate('sellerId', 'username displayName avatarUrl isSellerApproved')
    .populate('categoryId', 'name slug');
  if (!stream) throw new AppError('Stream not found', HTTP_STATUS.NOT_FOUND);
  return stream;
};

// ── Update scheduled stream ───────────────────────────────────────────────────

const updateStream = async (sellerId, streamId, data) => {
  const stream = await Stream.findOne({ _id: streamId, deletedAt: null });
  if (!stream) throw new AppError('Stream not found', HTTP_STATUS.NOT_FOUND);
  assertOwner(stream, sellerId);
  if (stream.status !== STREAM_STATUS.SCHEDULED) {
    throw new AppError('Only scheduled shows can be edited', HTTP_STATUS.CONFLICT);
  }

  if (data.title != null) stream.title = data.title;
  if (data.description !== undefined) stream.description = data.description;
  if (data.scheduledAt != null) stream.scheduledAt = new Date(data.scheduledAt);
  if (data.categoryId !== undefined) stream.categoryId = data.categoryId || null;
  if (data.thumbnailUrl !== undefined) stream.thumbnailUrl = data.thumbnailUrl || null;
  if (data.tags != null) stream.tags = data.tags;
  if (data.chatEnabled != null) stream.chatEnabled = data.chatEnabled;

  await stream.save();
  return stream;
};

// ── Create auction stream (starts immediately, pinned product) ────────────────

const createAuctionStream = async (seller, data) => {
  const product = await Product.findOne({ _id: data.productId, deletedAt: null });
  if (!product) throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
  if (!product.sellerId.equals(seller._id)) throw new AppError('Not authorized', HTTP_STATUS.FORBIDDEN);
  if (product.listingType !== 'auction') throw new AppError('Product must be an auction listing', HTTP_STATUS.BAD_REQUEST);
  if (product.status !== 'active') throw new AppError('Product must be active to start an auction', HTTP_STATUS.BAD_REQUEST);

  const callId = `auction_${seller._id}_${Date.now()}`;
  const client = getStreamClient();

  await upsertStreamUser(seller._id, seller.displayName || seller.username, seller.avatarUrl);

  const call = client.video.call('livestream', callId);
  await call.getOrCreate({
    data: {
      created_by_id: String(seller._id),
      custom: { title: data.title, sellerId: String(seller._id), isAuction: true },
      settings_override: { broadcasting: { enabled: true } },
    },
  });

  const stream = await Stream.create({
    sellerId: seller._id,
    title: data.title,
    description: data.description,
    categoryId: data.categoryId ?? null,
    thumbnailUrl: data.thumbnailUrl ?? null,
    tags: data.tags ?? [],
    chatEnabled: data.chatEnabled ?? true,
    callId,
    callType: 'livestream',
    status: STREAM_STATUS.LIVE,
    startedAt: new Date(),
    pinnedProducts: [product._id],
  });

  product.streamId = stream._id;
  await product.save();

  const token = generateStreamToken(seller._id, 'host');

  return {
    token,
    callId: stream.callId,
    callType: stream.callType,
    apiKey: process.env.STREAM_API_KEY,
    stream: stream.toObject(),
    role: 'host',
  };
};

// ── Cancel (soft delete before going live) ────────────────────────────────────

const cancelStream = async (sellerId, streamId) => {
  const stream = await Stream.findOne({ _id: streamId, deletedAt: null });
  if (!stream) throw new AppError('Stream not found', HTTP_STATUS.NOT_FOUND);
  assertOwner(stream, sellerId);
  if (stream.status === STREAM_STATUS.LIVE) throw new AppError('Cannot cancel a live stream — end it instead', HTTP_STATUS.CONFLICT);

  stream.status = STREAM_STATUS.CANCELLED;
  await stream.save();
  return stream;
};

module.exports = { createStream, createAuctionStream, updateStream, startStream, endStream, joinStream, getPublicStreams, getSellerStreams, getStream, cancelStream };
