const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// A buyer's review of a seller, tied to a delivered/completed order so only
// genuine customers can review. One review per (order) — enforced by index.
const ReviewSchema = new mongoose.Schema(
  {
    sellerId: { type: ObjectId, ref: 'User', required: true },
    buyerId: { type: ObjectId, ref: 'User', required: true },
    orderId: { type: ObjectId, ref: 'Order', required: true },

    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },

    // Denormalized buyer identity for rendering the list without a join.
    buyerName: { type: String, trim: true },
    buyerAvatarUrl: { type: String, trim: true },

    // Optional seller reply.
    sellerReply: { type: String, trim: true, maxlength: 1000 },
    sellerRepliedAt: { type: Date },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One review per order.
ReviewSchema.index({ orderId: 1 }, { unique: true });
// Seller review list, newest first.
ReviewSchema.index({ sellerId: 1, deletedAt: 1, createdAt: -1 });

module.exports = mongoose.model('Review', ReviewSchema);
