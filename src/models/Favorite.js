const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// A user's saved/wishlisted product. One row per (user, product).
const FavoriteSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    productId: { type: ObjectId, ref: 'Product', required: true },
  },
  { timestamps: true }
);

FavoriteSchema.index({ userId: 1, productId: 1 }, { unique: true });
FavoriteSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Favorite', FavoriteSchema);
