const mongoose = require('mongoose');
const { PAYOUT_STATUS } = require('../config/constants');

const { ObjectId } = mongoose.Schema.Types;

// A seller's withdrawal of available wallet funds to their connected bank /
// Stripe account. Created as `pending`, settled by the provider/admin.
const PayoutSchema = new mongoose.Schema(
  {
    sellerId: { type: ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'gbp' },

    provider: { type: String, default: 'mock' },
    providerPayoutId: { type: String },
    destination: { type: String, trim: true }, // e.g. masked bank/stripe account

    status: {
      type: String,
      enum: Object.values(PAYOUT_STATUS),
      default: PAYOUT_STATUS.PENDING,
    },

    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    failureReason: { type: String, trim: true },
  },
  { timestamps: true }
);

PayoutSchema.index({ sellerId: 1, createdAt: -1 });
PayoutSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Payout', PayoutSchema);
