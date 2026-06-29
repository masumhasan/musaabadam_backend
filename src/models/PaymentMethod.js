const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// A buyer's saved payment instrument. Only non-sensitive metadata is stored;
// the actual card lives at the payment provider (Stripe), referenced by token.
const PaymentMethodSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },

    provider: { type: String, default: 'mock' }, // 'stripe' | 'mock'
    providerPaymentMethodId: { type: String, required: true }, // e.g. Stripe pm_xxx

    brand: { type: String, trim: true }, // visa, mastercard, amex
    last4: { type: String, trim: true },
    expMonth: { type: Number, min: 1, max: 12 },
    expYear: { type: Number },

    isDefault: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PaymentMethodSchema.index({ userId: 1, deletedAt: 1 });

module.exports = mongoose.model('PaymentMethod', PaymentMethodSchema);
