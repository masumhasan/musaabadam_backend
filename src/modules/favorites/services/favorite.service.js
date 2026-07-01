const Favorite = require('../../../models/Favorite');
const Product = require('../../../models/Product');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS } = require('../../../config/constants');

// Toggle a product in the user's wishlist. Returns { favorited, favoritesCount }.
const toggleFavorite = async (userId, productId) => {
  const product = await Product.findOne({ _id: productId, deletedAt: null }).select('_id favoritesCount');
  if (!product) throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);

  const existing = await Favorite.findOne({ userId, productId });
  if (existing) {
    await existing.deleteOne();
    await Product.updateOne({ _id: productId }, { $inc: { favoritesCount: -1 } });
    return { favorited: false, favoritesCount: Math.max(0, (product.favoritesCount || 1) - 1) };
  }

  try {
    await Favorite.create({ userId, productId });
    await Product.updateOne({ _id: productId }, { $inc: { favoritesCount: 1 } });
  } catch (err) {
    if (err.code !== 11000) throw err; // ignore race double-add
  }
  return { favorited: true, favoritesCount: (product.favoritesCount || 0) + 1 };
};

// The user's wishlist (populated products), newest first.
const listFavorites = async (userId, { page = 1, limit = 20 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);
  const [favorites, total] = await Promise.all([
    Favorite.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate({
        path: 'productId',
        select: 'title price images listingType status currentHighBid startingPrice flashSale flashSalePrice sellerId',
      }),
    Favorite.countDocuments({ userId }),
  ]);

  const products = favorites.map((f) => f.productId).filter(Boolean);
  return { products, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
};

// Which of the given product ids the user has favorited (for list badges).
const favoritedIds = async (userId, productIds = []) => {
  if (!productIds.length) return [];
  const rows = await Favorite.find({ userId, productId: { $in: productIds } }).select('productId');
  return rows.map((r) => String(r.productId));
};

module.exports = { toggleFavorite, listFavorites, favoritedIds };
