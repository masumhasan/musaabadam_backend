const { HTTP_STATUS } = require('../../../config/constants');
const { verifyWebhookSignature } = require('../../../utils/streamClient');
const logger = require('../../../utils/logger');
const { getIO } = require('../../../socket');

const svc = require('../services/stream.service');

const create = async (req, res, next) => {
  try {
    const stream = await svc.createStream(req.user, req.body);
    res.status(HTTP_STATUS.CREATED).json({ success: true, data: { stream } });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const stream = await svc.updateStream(req.user._id, req.params.streamId, req.body);
    res.json({ success: true, data: { stream } });
  } catch (err) { next(err); }
};

const start = async (req, res, next) => {
  try {
    const stream = await svc.startStream(req.user._id, req.params.streamId);
    res.json({ success: true, data: { stream } });
  } catch (err) { next(err); }
};

const end = async (req, res, next) => {
  try {
    const stream = await svc.endStream(req.user._id, req.params.streamId);
    res.json({ success: true, data: { stream } });
  } catch (err) { next(err); }
};

const cancel = async (req, res, next) => {
  try {
    const stream = await svc.cancelStream(req.user._id, req.params.streamId);
    res.json({ success: true, data: { stream } });
  } catch (err) { next(err); }
};

const join = async (req, res, next) => {
  try {
    const result = await svc.joinStream(req.params.streamId, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const list = async (req, res, next) => {
  try {
    const result = await svc.getPublicStreams(req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const myStreams = async (req, res, next) => {
  try {
    const result = await svc.getSellerStreams(req.user._id, req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const detail = async (req, res, next) => {
  try {
    const stream = await svc.getStream(req.params.streamId);
    res.json({ success: true, data: { stream } });
  } catch (err) { next(err); }
};

const createAuction = async (req, res, next) => {
  try {
    const result = await svc.createAuctionStream(req.user, req.body);
    res.status(HTTP_STATUS.CREATED).json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ── Replays (past shows) ──────────────────────────────────────────────────────

const listReplays = async (req, res, next) => {
  try {
    const result = await svc.getReplays(req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const replay = async (req, res, next) => {
  try {
    const result = await svc.getReplay(req.params.streamId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ── GetStream webhook (recording lifecycle) ───────────────────────────────────
// Mounted with a raw body parser so the signature can be verified. Always returns
// 200 quickly for accepted events so GetStream does not retry needlessly.

const getStreamWebhook = async (req, res) => {
  const signature = req.get('x-signature');
  const rawBody = req.body; // Buffer (express.raw)

  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Invalid payload' });
  }

  // call_cid looks like "livestream:stream_<sellerId>_<ts>" — the part after ':' is our callId.
  const callId = event?.call_cid ? String(event.call_cid).split(':').slice(1).join(':') : null;

  try {
    if (event.type === 'call.recording_ready' && callId) {
      await svc.ingestRecording(callId, event.call_recording || {});
    } else if (event.type === 'call.recording_failed' && callId) {
      await svc.markRecordingFailed(callId);
    }
  } catch (err) {
    // Log but still 200 — GetStream retries are bounded and we've recorded the failure state.
    logger.error(`getstream webhook (${event.type}) handling failed: ${err.message}`);
  }

  return res.json({ success: true });
};

const feed = async (req, res, next) => {
  try {
    const result = await svc.getFeed(req.user._id, req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const publish = async (req, res, next) => {
  try {
    const stream = await svc.publishStream(req.user._id, req.params.streamId);
    res.json({ success: true, data: { stream } });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await svc.deleteStream(req.user._id, req.params.streamId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const pinProduct = async (req, res, next) => {
  try {
    const data = await svc.pinProduct(req.user._id, req.params.streamId, req.body.productId);
    getIO()?.to(`stream:${data.streamId}`).emit('product-pinned', data);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const unpinProduct = async (req, res, next) => {
  try {
    const data = await svc.unpinProduct(req.user._id, req.params.streamId, req.body.productId);
    getIO()?.to(`stream:${data.streamId}`).emit('product-unpinned', data);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  create,
  createAuction,
  update,
  start,
  end,
  cancel,
  join,
  list,
  myStreams,
  detail,
  listReplays,
  replay,
  getStreamWebhook,
  pinProduct,
  unpinProduct,
  publish,
  remove,
  feed,
};
