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

module.exports = { getStreamClient, generateStreamToken, upsertStreamUser };
