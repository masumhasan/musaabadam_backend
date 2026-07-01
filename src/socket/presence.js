const Stream = require('../models/Stream');
const logger = require('../utils/logger');

// In-memory viewer presence per stream room. Maps streamId → Map(socketId → userId).
// Unique viewer count = distinct userIds (a user on two devices counts once).
const roomViewers = new Map();

const uniqueCount = (streamId) => {
  const m = roomViewers.get(String(streamId));
  return m ? new Set([...m.values()]).size : 0;
};

const addViewer = async (io, streamId, socketId, userId) => {
  const key = String(streamId);
  if (!roomViewers.has(key)) roomViewers.set(key, new Map());
  roomViewers.get(key).set(socketId, String(userId));

  const count = uniqueCount(key);
  io.to(`stream:${key}`).emit('viewer-count', { streamId: key, count });
  io.to(`stream:${key}`).emit('viewer-joined', { streamId: key, userId: String(userId) });

  try {
    await Stream.updateOne(
      { _id: key },
      { $set: { currentViewers: count }, $max: { peakViewerCount: count }, $inc: { totalViewers: 1 } }
    );
  } catch (err) {
    logger.error('presence addViewer stat update failed', { error: err.message });
  }
};

// Remove a socket from whichever room it was in (used on leave + disconnect).
const removeViewer = async (io, socketId, onlyStreamId = null) => {
  for (const [key, m] of roomViewers) {
    if (onlyStreamId && key !== String(onlyStreamId)) continue;
    if (m.has(socketId)) {
      const userId = m.get(socketId);
      m.delete(socketId);
      const count = uniqueCount(key);
      io.to(`stream:${key}`).emit('viewer-count', { streamId: key, count });
      io.to(`stream:${key}`).emit('viewer-left', { streamId: key, userId });
      try {
        await Stream.updateOne({ _id: key }, { $set: { currentViewers: count } });
      } catch (err) {
        logger.error('presence removeViewer stat update failed', { error: err.message });
      }
      if (m.size === 0) roomViewers.delete(key);
    }
  }
};

module.exports = { addViewer, removeViewer, uniqueCount };
