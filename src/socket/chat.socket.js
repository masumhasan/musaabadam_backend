const Stream = require('../models/Stream');
const Message = require('../models/Message');
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

// Configurable slow mode: streamId -> seconds between messages per user.
const slowMode = new Map(); // streamId -> seconds
const lastMsgAt = new Map(); // `${streamId}:${userId}` -> epoch ms

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
    socket.on('send-message', async ({ streamId, text, replyTo }) => {
      try {
        if (!streamId || !text) return socket.emit('chat-error', { message: 'streamId and text are required' });
        if (isMuted(streamId, socket.user._id)) {
          return socket.emit('chat-error', { message: 'You are muted in this stream' });
        }
        if (!withinRate()) return socket.emit('chat-error', { message: 'You are sending messages too fast' });

        // Configurable slow mode (per-user interval).
        const slow = slowMode.get(String(streamId)) || 0;
        if (slow > 0) {
          const key = `${streamId}:${socket.user._id}`;
          const last = lastMsgAt.get(key) || 0;
          const waitMs = slow * 1000 - (Date.now() - last);
          if (waitMs > 0) {
            return socket.emit('chat-error', { message: `Slow mode: wait ${Math.ceil(waitMs / 1000)}s` });
          }
          lastMsgAt.set(key, Date.now());
        }

        const message = await chatService.createMessage({ streamId, sender: socket.user, text, replyTo });
        io.to(`stream:${streamId}`).emit('chat-message', message);
      } catch (err) {
        socket.emit('chat-error', { message: err.isOperational ? err.message : 'Failed to send message' });
      }
    });

    // Moderator sets the slow-mode interval (seconds; 0 = off).
    socket.on('set-slow-mode', async ({ streamId, seconds }) => {
      try {
        const stream = await Stream.findById(streamId);
        if (!chatService.canModerate(socket.user, stream)) {
          return socket.emit('chat-error', { message: 'Not authorized to moderate' });
        }
        const secs = Math.max(0, Math.min(300, Number(seconds) || 0));
        slowMode.set(String(streamId), secs);
        await Stream.updateOne({ _id: streamId }, { $set: { chatSlowModeSeconds: secs } });
        io.to(`stream:${streamId}`).emit('slow-mode-changed', { streamId, seconds: secs });
      } catch {
        socket.emit('chat-error', { message: 'Failed to set slow mode' });
      }
    });

    // Lightweight emoji reaction (not persisted as chat text by default).
    // Broadcast to OTHERS in the room only — the sender renders their own
    // reaction locally on tap, so echoing back would double it.
    socket.on('send-reaction', ({ streamId, emoji }) => {
      if (!streamId || !emoji) return;
      socket.to(`stream:${streamId}`).emit('reaction', {
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

    // Moderator persistently bans / unbans a viewer for this stream.
    socket.on('ban-user', async ({ streamId, userId, ban: shouldBan }) => {
      try {
        const stream = await Stream.findById(streamId);
        if (!chatService.canModerate(socket.user, stream)) {
          return socket.emit('chat-error', { message: 'Not authorized to moderate' });
        }
        const op = shouldBan === false ? { $pull: { bannedUserIds: userId } } : { $addToSet: { bannedUserIds: userId } };
        await Stream.updateOne({ _id: streamId }, op);
        io.to(`stream:${streamId}`).emit('user-banned', { streamId, userId, banned: shouldBan !== false });

        // Kick the banned user's sockets out of the room immediately.
        if (shouldBan !== false) {
          const sockets = await io.in(`stream:${streamId}`).fetchSockets();
          for (const s of sockets) {
            if (String(s.user?._id) === String(userId)) {
              s.emit('banned', { streamId, message: 'You have been banned from this stream' });
              s.leave(`stream:${streamId}`);
            }
          }
        }
      } catch {
        socket.emit('chat-error', { message: 'Failed to update ban state' });
      }
    });

    // Moderator pins / unpins a chat message.
    socket.on('pin-message', async ({ streamId, messageId }) => {
      try {
        const stream = await Stream.findById(streamId);
        if (!chatService.canModerate(socket.user, stream)) {
          return socket.emit('chat-error', { message: 'Not authorized to moderate' });
        }
        if (!messageId) {
          await Stream.updateOne({ _id: streamId }, { $unset: { pinnedMessageId: 1 } });
          return io.to(`stream:${streamId}`).emit('message-unpinned', { streamId });
        }
        const message = await Message.findOne({ _id: messageId, streamId });
        if (!message) return socket.emit('chat-error', { message: 'Message not found' });
        await Stream.updateOne({ _id: streamId }, { $set: { pinnedMessageId: messageId } });
        io.to(`stream:${streamId}`).emit('message-pinned', {
          streamId,
          message: {
            id: String(message._id),
            text: message.text,
            sender: { displayName: message.senderName, avatarUrl: message.senderAvatarUrl ?? null },
          },
        });
      } catch {
        socket.emit('chat-error', { message: 'Failed to pin message' });
      }
    });
  });

  logger.info('Chat socket handlers registered');
};

module.exports = { registerChatSocket };
