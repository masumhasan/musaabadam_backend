const Offer = require('../../../models/Offer');
const Product = require('../../../models/Product');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS } = require('../../../config/constants');
const { OFFER_STATUS } = require('../../../models/Offer');

const createOffer = async (buyerId, { productId, amount }) => {
  const product = await Product.findOne({ _id: productId, deletedAt: null });
  if (!product) {
    throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
  }
  if (!product.acceptOffers) {
    throw new AppError('This product does not accept offers', HTTP_STATUS.BAD_REQUEST);
  }

  // Create offer
  const offer = await Offer.create({
    productId,
    buyerId,
    sellerId: product.sellerId,
    amount,
    status: OFFER_STATUS.PENDING,
  });

  return offer;
};

const getBuyerOffers = async (buyerId, { page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(1, parseInt(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 20));

  const [offers, total] = await Promise.all([
    Offer.find({ buyerId })
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate('productId', 'title price images sellerId')
      .populate('sellerId', 'username displayName avatarUrl'),
    Offer.countDocuments({ buyerId }),
  ]);

  return { offers, pagination: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) } };
};

const getSellerOffers = async (sellerId, { page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(1, parseInt(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 20));

  const [offers, total] = await Promise.all([
    Offer.find({ sellerId })
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate('productId', 'title price images')
      .populate('buyerId', 'username displayName avatarUrl'),
    Offer.countDocuments({ sellerId }),
  ]);

  return { offers, pagination: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) } };
};

const updateOfferStatus = async (userId, offerId, status) => {
  const offer = await Offer.findById(offerId);
  if (!offer) {
    throw new AppError('Offer not found', HTTP_STATUS.NOT_FOUND);
  }

  if (status === OFFER_STATUS.CANCELLED) {
    if (!offer.buyerId.equals(userId)) {
      throw new AppError('Not authorized to cancel this offer', HTTP_STATUS.FORBIDDEN);
    }
  } else {
    // ACCEPTED or DECLINED
    if (!offer.sellerId.equals(userId)) {
      throw new AppError('Not authorized to update this offer', HTTP_STATUS.FORBIDDEN);
    }
  }

  offer.status = status;
  await offer.save();
  return offer;
};

module.exports = {
  createOffer,
  getBuyerOffers,
  getSellerOffers,
  updateOfferStatus,
};
