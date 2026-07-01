const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const GIVEAWAY_STATUS = Object.freeze({
  OPEN: 'open', // accepting entries
  DRAWN: 'drawn', // winner selected
  CANCELLED: 'cancelled',
});

// Who is allowed to enter.
const GIVEAWAY_RESTRICTION = Object.freeze({
  EVERYONE: 'everyone',
  FOLLOWERS: 'followers',
  BUYERS: 'buyers', // users who have purchased from this seller
});

const GiveawaySchema = new mongoose.Schema(
  {
    sellerId: { type: ObjectId, ref: 'User', required: true },
    streamId: { type: ObjectId, ref: 'Stream' },
    productId: { type: ObjectId, ref: 'Product' }, // the prize (optional)

    title: { type: String, required: true, trim: true, maxlength: 120 },
    restriction: {
      type: String,
      enum: Object.values(GIVEAWAY_RESTRICTION),
      default: GIVEAWAY_RESTRICTION.EVERYONE,
    },

    status: { type: String, enum: Object.values(GIVEAWAY_STATUS), default: GIVEAWAY_STATUS.OPEN },

    entryCount: { type: Number, default: 0 },
    winnerId: { type: ObjectId, ref: 'User' },
    winnerName: { type: String, trim: true },
    drawnAt: { type: Date },
  },
  { timestamps: true }
);

GiveawaySchema.index({ streamId: 1, status: 1 });
GiveawaySchema.index({ sellerId: 1, createdAt: -1 });

module.exports = mongoose.model('Giveaway', GiveawaySchema);
module.exports.GIVEAWAY_STATUS = GIVEAWAY_STATUS;
module.exports.GIVEAWAY_RESTRICTION = GIVEAWAY_RESTRICTION;
