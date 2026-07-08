const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const TipSchema = new mongoose.Schema(
  {
    buyerId: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },
    sellerId: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },
    streamId: {
      type: ObjectId,
      ref: 'Stream',
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    processingFee: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    message: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    providerIntentId: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

TipSchema.index({ buyerId: 1 });
TipSchema.index({ sellerId: 1 });
TipSchema.index({ streamId: 1 });

module.exports = mongoose.model('Tip', TipSchema);
