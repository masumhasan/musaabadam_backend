const mongoose = require('mongoose');
const Order = require('../../../models/Order');
const Product = require('../../../models/Product');
const { ORDER_STATUS } = require('../../../models/Order');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS } = require('../../../config/constants');

const VALID_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
};

const createOrder = async (buyerId, { items, shippingAddressSnapshot, streamId, notes }) => {
  if (!items || items.length === 0) {
    throw new AppError('Order must contain at least one item', HTTP_STATUS.BAD_REQUEST);
  }

  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds }, deletedAt: null });

  if (products.length !== productIds.length) {
    throw new AppError('One or more products not found', HTTP_STATUS.NOT_FOUND);
  }

  const productMap = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

  let sellerId = null;
  const orderItems = items.map((item) => {
    const product = productMap[item.productId];
    if (!product) throw new AppError(`Product ${item.productId} not found`, HTTP_STATUS.NOT_FOUND);
    if (product.status !== 'active') throw new AppError(`"${product.title}" is not available`, HTTP_STATUS.CONFLICT);
    if (product.quantity < item.quantity) {
      throw new AppError(`Insufficient stock for "${product.title}"`, HTTP_STATUS.CONFLICT);
    }
    if (sellerId && !product.sellerId.equals(sellerId)) {
      throw new AppError('All items in an order must be from the same seller', HTTP_STATUS.BAD_REQUEST);
    }
    sellerId = product.sellerId;

    const unitPrice =
      product.listingType === 'buy_it_now' ? product.price : product.currentHighBid || product.startingPrice || 0;

    return {
      productId: product._id,
      title: product.title,
      imageUrl: product.images[0] ?? null,
      quantity: item.quantity,
      unitPrice,
      totalPrice: unitPrice * item.quantity,
    };
  });

  const subtotal = orderItems.reduce((sum, i) => sum + i.totalPrice, 0);
  const totalAmount = subtotal; // shipping + tax calculated separately

  const order = await Order.create({
    buyerId,
    sellerId,
    streamId: streamId ?? null,
    items: orderItems,
    subtotal,
    shippingCost: 0,
    taxAmount: 0,
    totalAmount,
    shippingAddressSnapshot: shippingAddressSnapshot ?? null,
    notes: notes ?? null,
    status: ORDER_STATUS.PENDING,
  });

  return order;
};

const getBuyerOrders = async (buyerId, { status, page = 1, limit = 20 }) => {
  const query = { buyerId };
  if (status) query.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [orders, total] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('sellerId', 'username displayName avatarUrl'),
    Order.countDocuments(query),
  ]);

  return { orders, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
};

const getSellerOrders = async (sellerId, { status, page = 1, limit = 20 }) => {
  const query = { sellerId };
  if (status) query.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [orders, total] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('buyerId', 'username displayName avatarUrl'),
    Order.countDocuments(query),
  ]);

  return { orders, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
};

const getOrder = async (orderId, userId) => {
  const order = await Order.findById(orderId)
    .populate('buyerId', 'username displayName avatarUrl')
    .populate('sellerId', 'username displayName avatarUrl')
    .populate('streamId', 'title callId status');

  if (!order) throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);

  const isBuyer = order.buyerId._id.equals(userId);
  const isSeller = order.sellerId._id.equals(userId);
  if (!isBuyer && !isSeller) throw new AppError('Not authorized', HTTP_STATUS.FORBIDDEN);

  return order;
};

const updateOrderStatus = async (sellerId, orderId, { status, trackingNumber, trackingCarrier, cancelReason }) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  if (!order.sellerId.equals(sellerId)) throw new AppError('Not authorized', HTTP_STATUS.FORBIDDEN);

  if (!VALID_TRANSITIONS[order.status]?.includes(status)) {
    throw new AppError(`Cannot transition order from "${order.status}" to "${status}"`, HTTP_STATUS.CONFLICT);
  }

  order.status = status;

  if (status === ORDER_STATUS.SHIPPED) {
    order.shippedAt = new Date();
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (trackingCarrier) order.trackingCarrier = trackingCarrier;
  }
  if (status === ORDER_STATUS.DELIVERED) order.deliveredAt = new Date();
  if (status === ORDER_STATUS.CANCELLED) {
    order.cancelledAt = new Date();
    order.cancelReason = cancelReason ?? 'Cancelled by seller';
  }

  await order.save();
  return order;
};

const cancelOrder = async (buyerId, orderId, { cancelReason } = {}) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  if (!order.buyerId.equals(buyerId)) throw new AppError('Not authorized', HTTP_STATUS.FORBIDDEN);

  if (order.status !== ORDER_STATUS.PENDING) {
    throw new AppError('Only pending orders can be cancelled by the buyer', HTTP_STATUS.CONFLICT);
  }

  order.status = ORDER_STATUS.CANCELLED;
  order.cancelledAt = new Date();
  order.cancelReason = cancelReason ?? 'Cancelled by buyer';
  await order.save();
  return order;
};

module.exports = { createOrder, getBuyerOrders, getSellerOrders, getOrder, updateOrderStatus, cancelOrder };
