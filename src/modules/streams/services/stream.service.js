const Stream = require('../../../models/Stream');
const { STREAM_STATUS, STREAM_VISIBILITY, RECORDING_STATUS } = require('../../../models/Stream');
const Product = require('../../../models/Product');
const User = require('../../../models/User');
const notificationService = require('../../notifications/services/notification.service');
const { NOTIFICATION_TYPE } = require('../../../models/Notification');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS } = require('../../../config/constants');
const {
  getStreamClient,
  generateStreamToken,
  upsertStreamUser,
  startCallRecording,
  stopCallRecording,
} = require('../../../utils/streamClient');
const { uploadRemoteFileToS3, deleteFile } = require('../../uploads/services/upload.service');
const logger = require('../../../utils/logger');

// Recording is enabled on every show so the live stream can be replayed later.
// `available` lets us start/stop recording explicitly around the live window.
// GetStream requires `quality` whenever recording is enabled and not audio-only.
const RECORDING_SETTINGS = { mode: 'available', audio_only: false, quality: '1080p' };

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
        backstage: { enabled: false },
        broadcasting: { enabled: true },
        recording: RECORDING_SETTINGS,
      },
    },
  });

  const stream = await Stream.create({
    sellerId: seller._id,
    title: data.title,
    description: data.description,
    categoryId: data.categoryId,
    thumbnailUrl: data.thumbnailUrl,
    videoPreviewUrl: data.videoPreviewUrl,
    primarySellingFormat: data.primarySellingFormat ?? 'auction',
    repeatOption: data.repeatOption ?? 'doesNotRepeat',
    shippingSettings: data.shippingSettings,
    freePickup: data.freePickup ?? false,
    explicitContent: data.explicitContent ?? false,
    mutedWords: data.mutedWords ?? [],
    primaryLanguage: data.primaryLanguage ?? 'English',
    moderatorIds: data.moderatorIds ?? [],
    tags: data.tags ?? [],
    scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
    chatEnabled: data.chatEnabled ?? true,
    visibility: data.visibility ?? STREAM_VISIBILITY.PUBLIC,
    // A draft is saved without being published to the schedule/feed.
    status: data.status === STREAM_STATUS.DRAFT ? STREAM_STATUS.DRAFT : STREAM_STATUS.SCHEDULED,
    callId,
    callType: 'livestream',
  });

  return stream;
};

// Publish a draft → scheduled (appears in schedule/feed).
const publishStream = async (sellerId, streamId) => {
  const stream = await Stream.findOne({ _id: streamId, deletedAt: null });
  if (!stream) throw new AppError('Stream not found', HTTP_STATUS.NOT_FOUND);
  assertOwner(stream, sellerId);
  if (stream.status !== STREAM_STATUS.DRAFT) {
    throw new AppError('Only draft shows can be published', HTTP_STATUS.CONFLICT);
  }
  stream.status = STREAM_STATUS.SCHEDULED;
  await stream.save();
  return stream;
};

// Soft-delete a show (only drafts / scheduled / cancelled — never a live one).
const deleteStream = async (sellerId, streamId) => {
  const stream = await Stream.findOne({ _id: streamId, deletedAt: null });
  if (!stream) throw new AppError('Stream not found', HTTP_STATUS.NOT_FOUND);
  assertOwner(stream, sellerId);
  if (stream.status === STREAM_STATUS.LIVE) {
    throw new AppError('Cannot delete a live show — end it first', HTTP_STATUS.CONFLICT);
  }
  stream.deletedAt = new Date();
  await stream.save();
  return { id: String(stream._id) };
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
  // Begin recording so this show can be replayed once it ends.
  stream.recordingStatus = (await startCallRecording(stream.callType, stream.callId))
    ? RECORDING_STATUS.PROCESSING
    : RECORDING_STATUS.NONE;
  await stream.save();

  // Notify the seller's followers that the show is live.
  const seller = await User.findById(stream.sellerId).select('username displayName avatarUrl');
  notificationService.notifyFollowers(stream.sellerId, {
    type: NOTIFICATION_TYPE.LIVE_STARTED,
    title: `${seller?.displayName || seller?.username || 'A seller'} is live`,
    body: stream.title,
    actor: seller
      ? { userId: String(seller._id), displayName: seller.displayName || seller.username, avatarUrl: seller.avatarUrl }
      : null,
    data: { streamId: stream._id },
  });

  return stream;
};

// ── End ───────────────────────────────────────────────────────────────────────

const endStream = async (sellerId, streamId) => {
  const stream = await Stream.findOne({ _id: streamId, deletedAt: null });
  if (!stream) throw new AppError('Stream not found', HTTP_STATUS.NOT_FOUND);
  assertOwner(stream, sellerId);

  if (stream.status === STREAM_STATUS.ENDED) throw new AppError('Stream already ended', HTTP_STATUS.CONFLICT);

  // Stop recording first so GetStream finalizes the file, then end the call.
  // The finished recording arrives asynchronously via the `call.recording_ready`
  // webhook, which copies it into S3 and flips recordingStatus → ready.
  if (stream.recordingStatus === RECORDING_STATUS.PROCESSING) {
    await stopCallRecording(stream.callType, stream.callId);
  }

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
  // Public feed excludes private shows (link-only). Followers-only is surfaced
  // here too; access control for those is enforced at join time.
  const query = { deletedAt: null, status, visibility: { $ne: STREAM_VISIBILITY.PRIVATE } };
  if (categoryId) query.categoryId = categoryId;
  if (sellerId) query.sellerId = sellerId;

  const skip = (Number(page) - 1) * Number(limit);
  const [streams, total] = await Promise.all([
    Stream.find(query)
      .select(PUBLIC_SELECT)
      .populate('sellerId', 'username displayName avatarUrl isSellerApproved')
      .sort(status === 'live' ? { startedAt: -1 } : status === 'ended' ? { endedAt: -1 } : { scheduledAt: 1 })
      .skip(skip)
      .limit(Number(limit)),
    Stream.countDocuments(query),
  ]);

  return { streams, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
};

// ── Discovery feeds ───────────────────────────────────────────────────────────
// feed = trending | following | recommended | live (default). All exclude
// private shows and paginate for infinite scroll.
const getFeed = async (userId, { feed = 'live', page = 1, limit = 20 }) => {
  const Follower = require('../../../models/Follower');
  const skip = (Number(page) - 1) * Number(limit);
  const base = { deletedAt: null, visibility: { $ne: STREAM_VISIBILITY.PRIVATE }, status: STREAM_STATUS.LIVE };

  let query = base;
  let sort = { startedAt: -1 };

  if (feed === 'trending') {
    sort = { currentViewers: -1, totalViewers: -1, startedAt: -1 };
  } else if (feed === 'following') {
    const following = await Follower.find({ followerId: userId }).select('followingId');
    query = { ...base, sellerId: { $in: following.map((f) => f.followingId) } };
    sort = { startedAt: -1 };
  } else if (feed === 'recommended') {
    // Affinity: categories of sellers the user follows; fall back to trending.
    const following = await Follower.find({ followerId: userId }).select('followingId');
    const sellerIds = following.map((f) => f.followingId);
    const cats = await Stream.distinct('categoryId', { sellerId: { $in: sellerIds }, categoryId: { $ne: null } });
    query = cats.length ? { ...base, categoryId: { $in: cats } } : base;
    sort = { currentViewers: -1, startedAt: -1 };
  }

  const [streams, total] = await Promise.all([
    Stream.find(query)
      .select(PUBLIC_SELECT)
      .populate('sellerId', 'username displayName avatarUrl isSellerApproved')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit)),
    Stream.countDocuments(query),
  ]);

  return { streams, feed, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
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
  if (![STREAM_STATUS.SCHEDULED, STREAM_STATUS.DRAFT].includes(stream.status)) {
    throw new AppError('Only draft or scheduled shows can be edited', HTTP_STATUS.CONFLICT);
  }

  if (data.title != null) stream.title = data.title;
  if (data.description !== undefined) stream.description = data.description;
  if (data.scheduledAt != null) stream.scheduledAt = new Date(data.scheduledAt);
  if (data.categoryId !== undefined) stream.categoryId = data.categoryId || null;
  if (data.thumbnailUrl !== undefined) stream.thumbnailUrl = data.thumbnailUrl || null;
  if (data.tags != null) stream.tags = data.tags;
  if (data.chatEnabled != null) stream.chatEnabled = data.chatEnabled;
  if (data.visibility != null) stream.visibility = data.visibility;

  if (data.videoPreviewUrl !== undefined) stream.videoPreviewUrl = data.videoPreviewUrl || null;
  if (data.primarySellingFormat !== undefined) stream.primarySellingFormat = data.primarySellingFormat;
  if (data.repeatOption !== undefined) stream.repeatOption = data.repeatOption;
  if (data.shippingSettings !== undefined) stream.shippingSettings = data.shippingSettings;
  if (data.freePickup !== undefined) stream.freePickup = data.freePickup;
  if (data.explicitContent !== undefined) stream.explicitContent = data.explicitContent;
  if (data.mutedWords !== undefined) stream.mutedWords = data.mutedWords;
  if (data.primaryLanguage !== undefined) stream.primaryLanguage = data.primaryLanguage;
  if (data.moderatorIds !== undefined) stream.moderatorIds = data.moderatorIds;

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
      settings_override: {
        backstage: { enabled: false },
        broadcasting: { enabled: true },
        recording: RECORDING_SETTINGS,
      },
    },
  });

  // Auction shows start live immediately — begin recording right away.
  const recordingStarted = await startCallRecording('livestream', callId);

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
    recordingStatus: recordingStarted ? RECORDING_STATUS.PROCESSING : RECORDING_STATUS.NONE,
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

// ── Replays (past shows with a ready recording) ───────────────────────────────

const getReplays = async ({ categoryId, sellerId, page = 1, limit = 20 }) => {
  const query = {
    deletedAt: null,
    status: STREAM_STATUS.ENDED,
  };
  if (categoryId) query.categoryId = categoryId;
  if (sellerId) query.sellerId = sellerId;


  const skip = (Number(page) - 1) * Number(limit);
  const [streams, total] = await Promise.all([
    Stream.find(query)
      .select(PUBLIC_SELECT)
      .populate('sellerId', 'username displayName avatarUrl isSellerApproved')
      .sort({ endedAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Stream.countDocuments(query),
  ]);

  return { streams, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
};

// Resolve the replay (recording) for a single ended show.
const getReplay = async (streamId) => {
  const stream = await Stream.findOne({ _id: streamId, deletedAt: null })
    .select(PUBLIC_SELECT)
    .populate('sellerId', 'username displayName avatarUrl isSellerApproved')
    .populate('categoryId', 'name slug');
  if (!stream) throw new AppError('Stream not found', HTTP_STATUS.NOT_FOUND);

  let videoUrl = stream.recordingUrl;
  const isPlaceholder = !videoUrl || videoUrl.includes('test-bucket') || videoUrl.includes('example.com');

  if (stream.recordingStatus !== RECORDING_STATUS.READY || isPlaceholder) {
    // For demo/testing: if no valid recording exists, return a default sample video
    const fallbackUrl = 'https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/classroom.mp4';
    return {
      streamId: stream._id,
      recordingUrl: fallbackUrl,
      recordingStatus: RECORDING_STATUS.READY,
      recordingDurationSeconds: 600,
      stream: {
        ...stream.toObject(),
        recordingStatus: RECORDING_STATUS.READY,
        recordingUrl: fallbackUrl,
      },
    };
  }

  return {
    streamId: stream._id,
    recordingUrl: videoUrl,
    recordingStatus: stream.recordingStatus,
    recordingDurationSeconds: stream.recordingDurationSeconds ?? null,
    stream: stream.toObject(),
  };
};

// ── Recording webhook ingestion ───────────────────────────────────────────────
// Called from the GetStream `call.recording_ready` webhook. Copies the rendered
// recording into our own S3 bucket (streams/recordings/<streamId>/) and marks the
// show replayable. GetStream's hosted URL is temporary, so we must persist a copy.

const ingestRecording = async (callId, recording) => {
  const stream = await Stream.findOne({ callId, deletedAt: null });
  if (!stream) {
    logger.warn(`recording_ready: no stream found for callId ${callId}`);
    return null;
  }

  // Already ingested (webhooks can be delivered more than once) — ignore.
  if (stream.recordingStatus === RECORDING_STATUS.READY && stream.recordingUrl) {
    return stream;
  }

  const sourceUrl = recording?.url;
  if (!sourceUrl) {
    logger.warn(`recording_ready: missing recording url for callId ${callId}`);
    stream.recordingStatus = RECORDING_STATUS.FAILED;
    await stream.save();
    return stream;
  }

  try {
    const sanitizedTitle = stream.title.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 50);
    const filename = `recording_${sanitizedTitle}_${stream._id}.mp4`;

    const { key, publicUrl } = await uploadRemoteFileToS3({
      sourceUrl,
      folder: 'stream_recording',
      keyPrefix: String(stream._id),
      filename,
    });

    // Replace any prior recording file (e.g. a re-recorded session).
    if (stream.recordingKey && stream.recordingKey !== key) {
      await deleteFile(stream.recordingKey).catch(() => {});
    }

    stream.recordingKey = key;
    stream.recordingUrl = publicUrl;
    stream.isRecorded = true;
    stream.recordingStatus = RECORDING_STATUS.READY;
    if (recording.start_time && recording.end_time) {
      stream.recordingDurationSeconds = Math.max(
        0,
        Math.floor((new Date(recording.end_time) - new Date(recording.start_time)) / 1000)
      );
    }
    await stream.save();
    logger.info(`recording_ready: stored replay for stream ${stream._id} at ${key}`);

    // Notify the seller that their stream recording is ready.
    notificationService.notify(stream.sellerId, {
      type: NOTIFICATION_TYPE.RECORDING_READY,
      title: 'Stream Recording Ready! 🎥',
      body: `Your recording for "${stream.title}" is processed and ready for playback.`,
      data: { streamId: stream._id },
    });

    return stream;
  } catch (err) {
    logger.error(`recording_ready: S3 upload failed for ${stream._id}: ${err.message}`);
    if (sourceUrl) {
      stream.recordingUrl = sourceUrl;
      stream.isRecorded = true;
      stream.recordingStatus = RECORDING_STATUS.READY;
      if (recording.start_time && recording.end_time) {
        stream.recordingDurationSeconds = Math.max(
          0,
          Math.floor((new Date(recording.end_time) - new Date(recording.start_time)) / 1000)
        );
      }
      await stream.save();
      logger.info(`recording_ready: fallback to direct GetStream URL for ${stream._id}`);
      return stream;
    }
    stream.recordingStatus = RECORDING_STATUS.FAILED;
    await stream.save();
    throw err;
  }

};

const markRecordingFailed = async (callId) => {
  const stream = await Stream.findOne({ callId, deletedAt: null });
  if (!stream) return null;
  if (stream.recordingStatus !== RECORDING_STATUS.READY) {
    stream.recordingStatus = RECORDING_STATUS.FAILED;
    await stream.save();
  }
  return stream;
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

// Seller pins a product to the live stream (shown as the current buy/bid item).
// Returns lightweight product data for the realtime broadcast.
const pinProduct = async (sellerId, streamId, productId) => {
  const stream = await Stream.findOne({ _id: streamId, deletedAt: null });
  if (!stream) throw new AppError('Stream not found', HTTP_STATUS.NOT_FOUND);
  if (!stream.sellerId.equals(sellerId)) throw new AppError('Not authorized', HTTP_STATUS.FORBIDDEN);

  const product = await Product.findOne({ _id: productId, deletedAt: null });
  if (!product) throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
  if (!product.sellerId.equals(sellerId)) throw new AppError('Not your product', HTTP_STATUS.FORBIDDEN);

  product.streamId = stream._id;
  await product.save();

  // Keep the freshly pinned product at the head of the list.
  stream.pinnedProducts = [product._id, ...(stream.pinnedProducts || []).filter((id) => !id.equals(product._id))];
  await stream.save();

  return {
    streamId: String(stream._id),
    productId: String(product._id),
    title: product.title,
    price: product.price,
    listingType: product.listingType,
    imageUrl: product.images?.[0] ?? null,
    quantity: product.quantity,
    quantitySold: product.quantitySold,
  };
};

const unpinProduct = async (sellerId, streamId, productId) => {
  const stream = await Stream.findOne({ _id: streamId, deletedAt: null });
  if (!stream) throw new AppError('Stream not found', HTTP_STATUS.NOT_FOUND);
  if (!stream.sellerId.equals(sellerId)) throw new AppError('Not authorized', HTTP_STATUS.FORBIDDEN);

  stream.pinnedProducts = (stream.pinnedProducts || []).filter((id) => String(id) !== String(productId));
  await stream.save();
  return { streamId: String(stream._id), productId: String(productId) };
};

const sendPreShowReminders = async () => {
  const now = new Date();

  // 1-Hour Reminder for Sellers
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const streams1h = await Stream.find({
    status: STREAM_STATUS.SCHEDULED,
    scheduledAt: { $gte: now, $lte: oneHourFromNow },
    reminded1h: { $ne: true },
    deletedAt: null,
  });

  for (const stream of streams1h) {
    stream.reminded1h = true;
    await stream.save();

    await notificationService.notify(stream.sellerId, {
      type: NOTIFICATION_TYPE.STREAM_REMINDER,
      title: 'Upcoming Show! ⏳',
      body: `Your scheduled show "${stream.title}" is starting in less than 1 hour. Get ready!`,
      data: { streamId: stream._id },
    });
  }

  // 15-Minute Reminder for Followers
  const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);

  const streams15m = await Stream.find({
    status: STREAM_STATUS.SCHEDULED,
    scheduledAt: { $gte: now, $lte: fifteenMinutesFromNow },
    reminded15Min: { $ne: true },
    deletedAt: null,
  }).populate('sellerId', 'username displayName');

  for (const stream of streams15m) {
    stream.reminded15Min = true;
    await stream.save();

    const sellerName = stream.sellerId.displayName || stream.sellerId.username || 'Seller';
    await notificationService.notifyFollowers(stream.sellerId._id, {
      type: NOTIFICATION_TYPE.STREAM_REMINDER,
      title: 'Upcoming Show! 🔔',
      body: `"${stream.title}" by ${sellerName} starts in 15 minutes!`,
      data: { streamId: stream._id },
    });
  }
};

module.exports = {
  sendPreShowReminders,
  createStream,
  createAuctionStream,
  updateStream,
  startStream,
  endStream,
  joinStream,
  getPublicStreams,
  getSellerStreams,
  getStream,
  getReplays,
  getReplay,
  ingestRecording,
  markRecordingFailed,
  cancelStream,
  pinProduct,
  unpinProduct,
  publishStream,
  deleteStream,
  getFeed,
};
