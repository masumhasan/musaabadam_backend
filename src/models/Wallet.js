const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// Per-user wallet — source of truth for balances (User.walletBalance is a
// denormalized mirror of `available`). Sellers accrue `pending` while funds are
// in escrow; it moves to `available` on release, then out via payouts.
const WalletSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, unique: true },
    currency: { type: String, default: 'gbp' },

    available: { type: Number, default: 0, min: 0 }, // withdrawable now
    pending: { type: Number, default: 0, min: 0 }, // held in escrow, not yet released

    lifetimeEarned: { type: Number, default: 0, min: 0 },
    lifetimePaidOut: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Wallet', WalletSchema);
