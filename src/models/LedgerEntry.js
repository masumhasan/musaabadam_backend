const mongoose = require('mongoose');
const { LEDGER_TYPE } = require('../config/constants');

const { ObjectId } = mongoose.Schema.Types;

// Immutable record of every wallet movement. The running wallet balances are
// derived from / kept in sync with these entries for auditability.
const LedgerEntrySchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: Object.values(LEDGER_TYPE), required: true },

    // Signed amount applied to the relevant balance bucket.
    amount: { type: Number, required: true },
    currency: { type: String, default: 'gbp' },

    // Which bucket this entry moved money in/out of.
    bucket: { type: String, enum: ['available', 'pending'], default: 'available' },

    // Optional references for traceability.
    orderId: { type: ObjectId, ref: 'Order' },
    paymentId: { type: ObjectId, ref: 'Payment' },
    payoutId: { type: ObjectId, ref: 'Payout' },

    description: { type: String, trim: true },
  },
  { timestamps: true }
);

LedgerEntrySchema.index({ userId: 1, createdAt: -1 });
LedgerEntrySchema.index({ orderId: 1 });

module.exports = mongoose.model('LedgerEntry', LedgerEntrySchema);
