const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const OFFER_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
});

const OfferSchema = new mongoose.Schema(
  {
    productId: { type: ObjectId, ref: 'Product', required: true },
    buyerId: { type: ObjectId, ref: 'User', required: true },
    sellerId: { type: ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0.01 },
    status: {
      type: String,
      enum: Object.values(OFFER_STATUS),
      default: OFFER_STATUS.PENDING,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Offer', OfferSchema);
module.exports.OFFER_STATUS = OFFER_STATUS;
