const mongoose = require('mongoose');
const { PAYMENT_STATUS, ESCROW_STATUS } = require('../config/constants');

const { ObjectId } = mongoose.Schema.Types;

// A single payment against an order. Captures the money split (platform fee vs
// seller net) and tracks escrow state from capture through release/refund.
const PaymentSchema = new mongoose.Schema(
  {
    orderId: { type: ObjectId, ref: 'Order', required: true },
    buyerId: { type: ObjectId, ref: 'User', required: true },
    sellerId: { type: ObjectId, ref: 'User', required: true },

    provider: { type: String, default: 'mock' },
    providerIntentId: { type: String }, // Stripe PaymentIntent id
    paymentMethodId: { type: ObjectId, ref: 'PaymentMethod' },
    couponId: { type: ObjectId, ref: 'Reward' },
    discountAmount: { type: Number, default: 0 },

    currency: { type: String, default: 'gbp' },
    amount: { type: Number, required: true, min: 0 }, // gross charged to buyer
    platformFee: { type: Number, default: 0, min: 0 },
    sellerNet: { type: Number, default: 0, min: 0 }, // amount - platformFee

    refundedAmount: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.REQUIRES_PAYMENT,
    },
    escrowStatus: {
      type: String,
      enum: Object.values(ESCROW_STATUS),
      default: ESCROW_STATUS.NONE,
    },

    capturedAt: { type: Date },
    releasedAt: { type: Date },
    refundedAt: { type: Date },
    failureReason: { type: String, trim: true },
  },
  { timestamps: true }
);

PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ buyerId: 1, createdAt: -1 });
PaymentSchema.index({ sellerId: 1, escrowStatus: 1 });
PaymentSchema.index({ providerIntentId: 1 });

module.exports = mongoose.model('Payment', PaymentSchema);
