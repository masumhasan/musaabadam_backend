const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// Notification categories. Kept broad; `data` carries the deep-link refs.
const NOTIFICATION_TYPE = Object.freeze({
  LIVE_STARTED: 'live_started',
  AUCTION_STARTED: 'auction_started',
  OUTBID: 'outbid',
  AUCTION_WON: 'auction_won',
  ORDER_CONFIRMED: 'order_confirmed',
  ORDER_SHIPPED: 'order_shipped',
  ORDER_DELIVERED: 'order_delivered',
  GIVEAWAY_WON: 'giveaway_won',
  NEW_FOLLOWER: 'new_follower',
  NEW_MESSAGE: 'new_message',
  PAYOUT: 'payout',
  SYSTEM: 'system',
});

const NotificationSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true }, // recipient
    type: { type: String, enum: Object.values(NOTIFICATION_TYPE), required: true },

    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true },

    // Optional actor (who triggered it) for avatar/name rendering.
    actorId: { type: ObjectId, ref: 'User' },
    actorName: { type: String, trim: true },
    actorAvatarUrl: { type: String, trim: true },

    // Deep-link references for tap-through (any subset).
    data: {
      streamId: { type: ObjectId, ref: 'Stream' },
      productId: { type: ObjectId, ref: 'Product' },
      orderId: { type: ObjectId, ref: 'Order' },
      giveawayId: { type: ObjectId, ref: 'Giveaway' },
    },

    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
);

// Inbox listing (newest first) + unread badge counts.
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);
module.exports.NOTIFICATION_TYPE = NOTIFICATION_TYPE;
