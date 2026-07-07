const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const DirectMessageSchema = new mongoose.Schema(
  {
    senderId: { type: ObjectId, ref: 'User', required: true },
    receiverId: { type: ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

DirectMessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
DirectMessageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });

module.exports = mongoose.model('DirectMessage', DirectMessageSchema);
