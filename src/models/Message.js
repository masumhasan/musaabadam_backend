const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const MESSAGE_TYPE = Object.freeze({
  MESSAGE: 'message', // normal chat text
  REACTION: 'reaction', // emoji reaction
  SYSTEM: 'system', // system notice (user joined, auction won, etc.)
});

const MESSAGE_STATUS = Object.freeze({
  VISIBLE: 'visible',
  DELETED: 'deleted', // removed by a moderator
  FLAGGED: 'flagged', // auto-flagged by moderation, hidden pending review
});

// A single chat message within a live stream.
const MessageSchema = new mongoose.Schema(
  {
    streamId: { type: ObjectId, ref: 'Stream', required: true },
    senderId: { type: ObjectId, ref: 'User', required: true },

    type: { type: String, enum: Object.values(MESSAGE_TYPE), default: MESSAGE_TYPE.MESSAGE },
    text: { type: String, trim: true, maxlength: 500 },

    // Denormalized sender identity so history renders without a join.
    senderName: { type: String, trim: true },
    senderAvatarUrl: { type: String, trim: true },

    // Threaded reply to another message in the same stream.
    replyTo: { type: ObjectId, ref: 'Message' },
    // @mentioned users (resolved from @username tokens at send time).
    mentions: [{ type: ObjectId, ref: 'User' }],

    status: { type: String, enum: Object.values(MESSAGE_STATUS), default: MESSAGE_STATUS.VISIBLE },
    moderatedBy: { type: ObjectId, ref: 'User' },
    moderationReason: { type: String, trim: true },
  },
  { timestamps: true }
);

// Stream history, newest first.
MessageSchema.index({ streamId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);
module.exports.MESSAGE_TYPE = MESSAGE_TYPE;
module.exports.MESSAGE_STATUS = MESSAGE_STATUS;
