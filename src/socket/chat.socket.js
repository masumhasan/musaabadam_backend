const Stream = require('../models/Stream');
const chatService = require('../modules/chat/services/chat.service');
const logger = require('../utils/logger');

// In-memory mute registry: streamId -> Set(mutedUserId). Cleared on restart;
// fine for live moderation (mutes only matter for the duration of a show).
const mutes = new Map();
const isMuted = (streamId, userId) => mutes.get(String(streamId))?.has(String(userId)) === true;
const mute = (streamId, userId) => {
  const key = String(streamId);
  if (!mutes.has(key)) mutes.set(key, new Set());
  mutes.get(key).add(String(userId));
};
const unmute = (streamId, userId) => mutes.get(String(streamId))?.delete(String(userId));

// Simple per-socket rate limit: max N messages per window.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 5000;

// NOTE: this registers chat handlers on the SAME io as bidding. The shared
// auth middleware (registered by bidding) already populates socket.user.
const registerChatSocket = (io) => {
  io.on('connection', (socket) => {
    socket._chatTimestamps = [];

    const withinRate = () => {
      const now = Date.now();
      socket._chatTimestamps = socket._chatTimestamps.filter((t) => now - t < RATE_WINDOW_MS);
      if (socket._chatTimestamps.length >= RATE_LIMIT) return false;
      socket._chatTimestamps.push(now);
      return true;
    };

    // Send a chat message to a stream room.
    socket.on('send-message', async ({ streamId, text }) => {
      try {
        if (!streamId || !text) return socket.emit('chat-error', { message: 'streamId and text are required' });
        if (isMuted(streamId, socket.user._id)) {
          return socket.emit('chat-error', { message: 'You are muted in this stream' });
        }
        if (!withinRate()) return socket.emit('chat-error', { message: 'You are sending messages too fast' });

        const message = await chatService.createMessage({ streamId, sender: socket.user, text });
        io.to(`stream:${streamId}`).emit('chat-message', message);
      } catch (err) {
        socket.emit('chat-error', { message: err.isOperational ? err.message : 'Failed to send message' });
      }
    });

    // Lightweight emoji reaction (not persisted as chat text by default).
    socket.on('send-reaction', ({ streamId, emoji }) => {
      if (!streamId || !emoji) return;
      io.to(`stream:${streamId}`).emit('reaction', {
        streamId,
        emoji,
        userId: String(socket.user._id),
        displayName: socket.user.displayName || socket.user.username,
      });
    });

    // Moderator deletes a message.
    socket.on('delete-message', async ({ messageId }) => {
      try {
        const result = await chatService.deleteMessage(messageId, socket.user);
        io.to(`stream:${result.streamId}`).emit('message-deleted', result);
      } catch (err) {
        socket.emit('chat-error', { message: err.isOperational ? err.message : 'Failed to delete message' });
      }
    });

    // Moderator mutes / unmutes a viewer for this stream.
    socket.on('mute-user', async ({ streamId, userId, mute: shouldMute }) => {
      try {
        const stream = await Stream.findById(streamId);
        if (!chatService.canModerate(socket.user, stream)) {
          return socket.emit('chat-error', { message: 'Not authorized to moderate' });
        }
        if (shouldMute === false) unmute(streamId, userId);
        else mute(streamId, userId);
        io.to(`stream:${streamId}`).emit('user-muted', { streamId, userId, muted: shouldMute !== false });
      } catch {
        socket.emit('chat-error', { message: 'Failed to update mute state' });
      }
    });
  });

  logger.info('Chat socket handlers registered');
};

module.exports = { registerChatSocket };
