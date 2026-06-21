const { StreamClient } = require('@stream-io/node-sdk');

let _client = null;

const getStreamClient = () => {
  if (_client) return _client;

  const key = process.env.STREAM_API_KEY;
  const secret = process.env.STREAM_API_SECRET;

  if (!key || !secret) {
    throw new Error('STREAM_API_KEY and STREAM_API_SECRET must be set in environment');
  }

  _client = new StreamClient(key, secret);
  return _client;
};

// Token valid for 24 hours (viewer) or 8 hours (host)
const generateStreamToken = (userId, role = 'viewer') => {
  const client = getStreamClient();
  const validitySeconds = role === 'host' ? 8 * 3600 : 24 * 3600;
  return client.generateUserToken({ user_id: String(userId), validity_in_seconds: validitySeconds });
};

// Upsert a user in GetStream so they can be referenced in calls
const upsertStreamUser = async (userId, name, imageUrl) => {
  const client = getStreamClient();
  await client.upsertUsers([
    { id: String(userId), name: name || String(userId), image: imageUrl },
  ]);
};

// ── Recording ────────────────────────────────────────────────────────────────
// Recording must be enabled in the call settings (we pass `recording.mode`
// when creating the call). These wrappers are best-effort — they never throw,
// so a recording hiccup can't block the live-stream lifecycle.

const startCallRecording = async (callType, callId) => {
  try {
    await getStreamClient().video.call(callType, callId).startRecording();
    return true;
  } catch (err) {
    return false;
  }
};

const stopCallRecording = async (callType, callId) => {
  try {
    await getStreamClient().video.call(callType, callId).stopRecording();
    return true;
  } catch (err) {
    return false;
  }
};

// Verify an incoming GetStream webhook using the x-signature header.
// `rawBody` must be the unparsed request body (Buffer/string).
const verifyWebhookSignature = (rawBody, signature) => {
  if (!signature) return false;
  try {
    return getStreamClient().verifyWebhook(rawBody, signature);
  } catch {
    return false;
  }
};

module.exports = {
  getStreamClient,
  generateStreamToken,
  upsertStreamUser,
  startCallRecording,
  stopCallRecording,
  verifyWebhookSignature,
};
