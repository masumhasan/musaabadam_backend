const mongoose = require('mongoose');

const RewardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
    },
    discountType: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'fixed',
    },
    discountValue: {
      type: Number,
      required: true,
    },
    minOrderValue: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    usedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

RewardSchema.methods.isValidForOrder = function (orderTotal) {
  if (this.isUsed) return false;
  if (this.expiresAt < new Date()) return false;
  if (orderTotal < this.minOrderValue) return false;
  return true;
};

module.exports = mongoose.model('Reward', RewardSchema);
