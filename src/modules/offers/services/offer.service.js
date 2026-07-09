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
    offer.status = status;
    await offer.save();
    return offer;
  }

  // ACCEPTED or DECLINED
  if (!offer.sellerId.equals(userId)) {
    throw new AppError('Not authorized to update this offer', HTTP_STATUS.FORBIDDEN);
  }

  if (status === OFFER_STATUS.ACCEPTED && offer.status !== OFFER_STATUS.ACCEPTED) {
    const Product = require('../../../models/Product');
    const product = await Product.findById(offer.productId);
    
    if (!product || product.deletedAt) {
      throw new AppError('Product is no longer available', HTTP_STATUS.CONFLICT);
    }

    if (product.quantity <= 0) {
      throw new AppError('Product is out of stock', HTTP_STATUS.CONFLICT);
    }

    // Process the payment & order
    const PaymentMethod = require('../../../models/PaymentMethod');
    const defaultPm = await PaymentMethod.findOne({ userId: offer.buyerId, isDefault: true, deletedAt: null });
    
    // Create the order
    const Order = require('../../../models/Order');
    const { ORDER_STATUS } = Order;
    const shippingCost = product.shippingProfileId ? (product.shippingCost || 0) : 0;
    
    const order = await Order.create({
      buyerId: offer.buyerId,
      sellerId: offer.sellerId,
      items: [{
        productId: product._id,
        title: product.title,
        imageUrl: product.images?.[0] || '',
        quantity: 1,
        unitPrice: offer.amount,
        totalPrice: offer.amount
      }],
      subtotal: offer.amount,
      shippingCost: shippingCost,
      taxAmount: 0,
      totalAmount: offer.amount + shippingCost,
      status: ORDER_STATUS.PENDING
    });

    const paymentService = require('../../payments/services/payment.service');
    
    try {
      await paymentService.createCheckout(offer.buyerId, order._id, { paymentMethodId: defaultPm?._id });
      await paymentService.confirmPayment(offer.buyerId, order._id, { paymentMethodId: defaultPm?._id });
      
      offer.status = OFFER_STATUS.ACCEPTED;
      await offer.save();

      // Notifications
      const Notification = require('../../../models/Notification');
      const { NOTIFICATION_TYPE } = Notification;
      await Notification.create({
        userId: offer.buyerId,
        type: NOTIFICATION_TYPE.ORDER_CONFIRMED,
        title: 'Offer Accepted & Order Confirmed',
        message: `Your offer for ${product.title} was accepted and payment succeeded!`,
        metadata: { orderId: order._id, offerId: offer._id }
      });
      await Notification.create({
        userId: offer.sellerId,
        type: NOTIFICATION_TYPE.ORDER_CONFIRMED,
        title: 'Offer Accepted & Order Created',
        message: `You accepted an offer for ${product.title} and the buyer's payment succeeded.`,
        metadata: { orderId: order._id, offerId: offer._id }
      });
      
    } catch (err) {
      // Payment failed
      offer.status = OFFER_STATUS.ACCEPTED;
      await offer.save();
      
      // Update order to indicate payment failed
      order.status = ORDER_STATUS.PENDING; 
      order.notes = 'Payment failed during offer acceptance.';
      await order.save();

      const Notification = require('../../../models/Notification');
      const { NOTIFICATION_TYPE } = Notification;
      await Notification.create({
        userId: offer.buyerId,
        type: NOTIFICATION_TYPE.SYSTEM_ALERT,
        title: 'Offer Accepted, but Payment Failed',
        message: `Your offer for ${product.title} was accepted, but we couldn't charge your default payment method. Please update it to complete the purchase.`,
        metadata: { orderId: order._id, offerId: offer._id }
      });
      
      throw new AppError(`Buyer's payment failed: ${err.message}. The buyer has been notified to update their payment method.`, HTTP_STATUS.PAYMENT_REQUIRED);
    }
    
    return offer;
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
