const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// Status of an individual bid within an auction's lifecycle
const BID_STATUS = Object.freeze({
  ACTIVE: 'active', // currently the leading bid (or a valid prior bid)
  OUTBID: 'outbid', // superseded by a higher bid
  WON: 'won', // leading bid when the auction closed and reserve was met
  LOST: 'lost', // auction closed, this bid did not win
  CANCELLED: 'cancelled', // retracted / voided (e.g. auction cancelled)
});

const BidSchema = new mongoose.Schema(
  {
    productId: { type: ObjectId, ref: 'Product', required: true },
    streamId: { type: ObjectId, ref: 'Stream' },
    bidderId: { type: ObjectId, ref: 'User', required: true },

    amount: { type: Number, required: true, min: 0 },

    // Auto-bid: bidder's maximum the system will proxy-bid up to
    maxAmount: { type: Number, min: 0 },
    isAutoBid: { type: Boolean, default: false },

    status: {
      type: String,
      enum: Object.values(BID_STATUS),
      default: BID_STATUS.ACTIVE,
    },
  },
  { timestamps: true }
);

// Bid history for a product, newest first
BidSchema.index({ productId: 1, createdAt: -1 });
// A bidder's standing auto-bid on a product
BidSchema.index({ productId: 1, bidderId: 1, isAutoBid: 1 });
BidSchema.index({ streamId: 1, createdAt: -1 });

module.exports = mongoose.model('Bid', BidSchema);
module.exports.BID_STATUS = BID_STATUS;
