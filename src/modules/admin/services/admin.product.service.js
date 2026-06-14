const Product = require('../../../models/Product');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS, PRODUCT_STATUS } = require('../../../config/constants');

const listProducts = async ({ status, listingType, sellerId, search, page = 1, limit = 20 }) => {
  const query = { deletedAt: null };
  if (status) query.status = status;
  if (listingType) query.listingType = listingType;
  if (sellerId) query.sellerId = sellerId;
  if (search) query.$text = { $search: search };

  const skip = (Number(page) - 1) * Number(limit);
  const [products, total] = await Promise.all([
    Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('sellerId', 'username email displayName avatarUrl'),
    Product.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / Number(limit));
  return { products, total, page: Number(page), limit: Number(limit), totalPages };
};

const deactivateProduct = async (productId) => {
  const product = await Product.findOne({ _id: productId, deletedAt: null });
  if (!product) throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
  if (product.status === PRODUCT_STATUS.INACTIVE) {
    throw new AppError('Product is already inactive', HTTP_STATUS.CONFLICT);
  }
  product.status = PRODUCT_STATUS.INACTIVE;
  await product.save();
  return product;
};

const activateProduct = async (productId) => {
  const product = await Product.findOne({ _id: productId, deletedAt: null });
  if (!product) throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
  if (product.status === PRODUCT_STATUS.ACTIVE) {
    throw new AppError('Product is already active', HTTP_STATUS.CONFLICT);
  }
  product.status = PRODUCT_STATUS.ACTIVE;
  await product.save();
  return product;
};

module.exports = { listProducts, deactivateProduct, activateProduct };
