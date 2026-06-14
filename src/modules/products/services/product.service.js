const Product = require('../../../models/Product');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS, LISTING_TYPES, PRODUCT_STATUS } = require('../../../config/constants');

const PUBLIC_SELECT = '-costPerItem -sku -reservePrice -highestBidderId';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const assertListingRequirements = (data) => {
  if (data.listingType === LISTING_TYPES.AUCTION) {
    if (!data.startingPrice) throw new AppError('Starting price required for auction', HTTP_STATUS.BAD_REQUEST);
    if (!data.auctionEndsAt) throw new AppError('Auction end time required', HTTP_STATUS.BAD_REQUEST);
    if (new Date(data.auctionEndsAt) <= new Date()) {
      throw new AppError('Auction end time must be in the future', HTTP_STATUS.BAD_REQUEST);
    }
  }
  if (data.listingType === LISTING_TYPES.BUY_IT_NOW && (!data.price || data.price <= 0)) {
    throw new AppError('Price required for Buy It Now listings', HTTP_STATUS.BAD_REQUEST);
  }
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

const createProduct = async (sellerId, data) => {
  assertListingRequirements(data);
  const status = data.publishNow ? PRODUCT_STATUS.ACTIVE : PRODUCT_STATUS.DRAFT;
  return Product.create({ ...data, sellerId, status });
};

const updateProduct = async (sellerId, productId, updates) => {
  const product = await Product.findByIdAndSeller(productId, sellerId);
  if (!product) throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);

  if (product.status === PRODUCT_STATUS.ACTIVE && updates.listingType) {
    throw new AppError('Cannot change listing type of an active product', HTTP_STATUS.BAD_REQUEST);
  }

  Object.assign(product, updates);
  assertListingRequirements(product);
  await product.save();
  return product;
};

const deleteProduct = async (sellerId, productId) => {
  const product = await Product.findByIdAndSeller(productId, sellerId);
  if (!product) throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
  product.deletedAt = new Date();
  await product.save();
};

const publishProduct = async (sellerId, productId) => {
  const product = await Product.findByIdAndSeller(productId, sellerId);
  if (!product) throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
  if (product.status !== PRODUCT_STATUS.DRAFT) {
    throw new AppError('Only draft products can be published', HTTP_STATUS.BAD_REQUEST);
  }
  product.status = PRODUCT_STATUS.ACTIVE;
  await product.save();
  return product;
};

const deactivateProduct = async (sellerId, productId) => {
  const product = await Product.findByIdAndSeller(productId, sellerId);
  if (!product) throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
  if (product.status !== PRODUCT_STATUS.ACTIVE) {
    throw new AppError('Only active products can be deactivated', HTTP_STATUS.BAD_REQUEST);
  }
  product.status = PRODUCT_STATUS.INACTIVE;
  await product.save();
  return product;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

const getProduct = async (productId) => {
  const product = await Product.findOne({ _id: productId, deletedAt: null })
    .select(PUBLIC_SELECT)
    .populate('sellerId', 'username avatarUrl followersCount sellerProfile');
  if (!product) throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
  await Product.findByIdAndUpdate(productId, { $inc: { viewsCount: 1 } });
  return product;
};

const getSellerInventory = async (sellerId, { status, page = 1, limit = 20 }) => {
  const safePage = Math.max(1, parseInt(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 20));

  const query = { sellerId, deletedAt: null };
  if (status) query.status = status;

  const [products, total] = await Promise.all([
    Product.find(query).sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit),
    Product.countDocuments(query),
  ]);

  return { products, pagination: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) } };
};

const getPublicProducts = async (filters = {}, pagination = {}) => {
  const {
    category, listingType, condition, search,
    minPrice, maxPrice, sellerId,
    status = PRODUCT_STATUS.ACTIVE, sort = 'newest',
  } = filters;

  const safePage = Math.max(1, parseInt(pagination.page) || 1);
  const safeLimit = Math.min(50, Math.max(1, parseInt(pagination.limit) || 20));

  const query = { deletedAt: null, status };
  if (category) query.category = new RegExp(category, 'i');
  if (listingType) query.listingType = listingType;
  if (condition) query.condition = condition;
  if (sellerId) query.sellerId = sellerId;
  if (search) query.$text = { $search: search };

  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceRange = {};
    if (minPrice !== undefined) priceRange.$gte = parseFloat(minPrice);
    if (maxPrice !== undefined) priceRange.$lte = parseFloat(maxPrice);
    query.$or = [
      { listingType: LISTING_TYPES.BUY_IT_NOW, price: priceRange },
      { listingType: LISTING_TYPES.AUCTION, startingPrice: priceRange },
    ];
  }

  const sortMap = {
    newest: { createdAt: -1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    ending_soon: { auctionEndsAt: 1 },
  };

  const [products, total] = await Promise.all([
    Product.find(query)
      .sort(sortMap[sort] || sortMap.newest)
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .select(PUBLIC_SELECT)
      .populate('sellerId', 'username avatarUrl sellerProfile'),
    Product.countDocuments(query),
  ]);

  return { products, pagination: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) } };
};

module.exports = {
  createProduct, updateProduct, deleteProduct, publishProduct, deactivateProduct,
  getProduct, getSellerInventory, getPublicProducts,
};
