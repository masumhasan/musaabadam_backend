const Message = require('../../../models/Message');
const { MESSAGE_TYPE, MESSAGE_STATUS } = require('../../../models/Message');
const Stream = require('../../../models/Stream');
const User = require('../../../models/User');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS, ROLES } = require('../../../config/constants');

// Extract @username tokens from message text and resolve them to user ids.
const resolveMentions = async (text) => {
  const handles = [...new Set((text.match(/@([a-zA-Z0-9_.-]{3,30})/g) || []).map((h) => h.slice(1)))];
  if (handles.length === 0) return [];
  const users = await User.find({ username: { $in: handles }, deletedAt: null }).select('_id');
  return users.map((u) => u._id);
};

// Minimal profanity filter. Replace with an AI moderation provider later
// (the "AI-based chat moderation" roadmap item).

// Roles allowed to moderate a stream's chat.
const MOD_ROLES = [ROLES.SELLER, ROLES.MODERATOR, ROLES.COHOST, ROLES.ADMIN];
const canModerate = (user, stream) => {
  if (!user) return false;
  if (MOD_ROLES.includes(user.role)) return true;
  if (stream && stream.sellerId && String(stream.sellerId) === String(user._id)) return true;
  if (stream && Array.isArray(stream.cohostIds) && stream.cohostIds.some((id) => String(id) === String(user._id))) {
    return true;
  }
  return false;
};

// Persist + return a chat message after running moderation. `sender` is the
// authenticated socket user document (or REST req.user).
const createMessage = async ({ streamId, sender, text, type = MESSAGE_TYPE.MESSAGE, replyTo = null }) => {
  const trimmed = (text || '').trim();
  if (type === MESSAGE_TYPE.MESSAGE && !trimmed) {
    throw new AppError('Message cannot be empty', HTTP_STATUS.BAD_REQUEST);
  }
  if (trimmed.length > 500) {
    throw new AppError('Message too long (max 500 chars)', HTTP_STATUS.BAD_REQUEST);
  }

  const stream = await Stream.findOne({ _id: streamId, deletedAt: null });
  if (!stream) throw new AppError('Stream not found', HTTP_STATUS.NOT_FOUND);
  if (stream.chatEnabled === false) throw new AppError('Chat is disabled for this stream', HTTP_STATUS.FORBIDDEN);

  const PlatformSetting = require('../../../models/PlatformSetting');
  const platformSettings = await PlatformSetting.findOne({ type: 'global' });
  const globalMutedWords = platformSettings?.globalMutedWords || [];
  const streamMutedWords = stream.mutedWords || [];
  const allMutedWords = [...globalMutedWords, ...streamMutedWords];

  for (const word of allMutedWords) {
    if (!word) continue;
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');
    if (regex.test(trimmed)) {
      throw new AppError('Message contains a restricted word', HTTP_STATUS.BAD_REQUEST);
    }
  }

  const cleaned = trimmed;

  // Validate the replied-to message belongs to this stream.
  let replyRef = null;
  if (replyTo) {
    const parent = await Message.findOne({ _id: replyTo, streamId }).select('_id');
    if (parent) replyRef = parent._id;
  }

  const mentions = await resolveMentions(trimmed);

  const message = await Message.create({
    streamId,
    senderId: sender._id,
    type,
    text: cleaned,
    senderName: sender.displayName || sender.username,
    senderAvatarUrl: sender.avatarUrl ?? null,
    status: MESSAGE_STATUS.VISIBLE,
    replyTo: replyRef,
    mentions,
  });

  await message.populate('replyTo', 'text senderName');
  return serialize(message);
};

const getHistory = async (streamId, { limit = 50, before } = {}) => {
  const query = { streamId, status: MESSAGE_STATUS.VISIBLE };
  if (before) query.createdAt = { $lt: new Date(before) };

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .populate('replyTo', 'text senderName');
  // Return chronological (oldest first) for rendering.
  return messages.reverse().map(serialize);
};

const deleteMessage = async (messageId, moderator) => {
  const message = await Message.findById(messageId);
  if (!message) throw new AppError('Message not found', HTTP_STATUS.NOT_FOUND);

  const stream = await Stream.findById(message.streamId);
  if (!canModerate(moderator, stream)) throw new AppError('Not authorized to moderate', HTTP_STATUS.FORBIDDEN);

  message.status = MESSAGE_STATUS.DELETED;
  message.moderatedBy = moderator._id;
  message.moderationReason = 'Removed by moderator';
  await message.save();
  return { messageId: String(message._id), streamId: String(message.streamId) };
};

const serialize = (m) => ({
  id: String(m._id),
  streamId: String(m.streamId),
  type: m.type,
  text: m.text,
  status: m.status,
  sender: {
    userId: String(m.senderId),
    displayName: m.senderName,
    avatarUrl: m.senderAvatarUrl ?? null,
  },
  replyTo: m.replyTo && m.replyTo._id
    ? { id: String(m.replyTo._id), text: m.replyTo.text, senderName: m.replyTo.senderName }
    : null,
  createdAt: m.createdAt,
});

module.exports = { createMessage, getHistory, deleteMessage, canModerate };
