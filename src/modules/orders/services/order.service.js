const mongoose = require('mongoose');
const Order = require('../../../models/Order');
const Product = require('../../../models/Product');
const { ORDER_STATUS } = require('../../../models/Order');
const paymentService = require('../../payments/services/payment.service');
const shippingService = require('../../shipping/services/shipping.service');
const ShippingProfile = require('../../../models/ShippingProfile');
const { computeTax } = require('../../../utils/tax');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS } = require('../../../config/constants');

const round2 = (n) => Math.round(n * 100) / 100;

// Shipping (from the seller's default profile) + region tax (from the shipping
// address country). Returns { shippingCost, taxAmount, totalAmount }.
const computeCharges = async ({ sellerId, subtotal, weightKg = 0, country = null }) => {
  const profile =
    (await ShippingProfile.findOne({ sellerId, deletedAt: null, isDefault: true })) ||
    (await ShippingProfile.findOne({ sellerId, deletedAt: null }));
  let shippingCost = 0;
  try {
    shippingCost = round2(shippingService.computeRate(profile, { subtotal, weightKg }));
  } catch {
    shippingCost = round2(profile?.flatRate || 0);
  }
  const taxAmount = computeTax(subtotal, country);
  const totalAmount = round2(subtotal + shippingCost + taxAmount);
  return { shippingCost, taxAmount, totalAmount };
};

const VALID_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.COMPLETED],
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
      product.listingType === 'buy_it_now'
        ? product.effectivePrice()
        : product.currentHighBid || product.startingPrice || 0;

    return {
      productId: product._id,
      title: product.title,
      imageUrl: product.images[0] ?? null,
      quantity: item.quantity,
      unitPrice,
      totalPrice: unitPrice * item.quantity,
    };
  });

  const subtotal = round2(orderItems.reduce((sum, i) => sum + i.totalPrice, 0));
  const weightKg = products.reduce((w, p) => w + (p.shippingWeight || 0), 0);

  const { shippingCost, taxAmount, totalAmount } = await computeCharges({
    sellerId,
    subtotal,
    weightKg,
    country: shippingAddressSnapshot?.country ?? null,
  });

  const order = await Order.create({
    buyerId,
    sellerId,
    streamId: streamId ?? null,
    items: orderItems,
    subtotal,
    shippingCost,
    taxAmount,
    totalAmount,
    shippingAddressSnapshot: shippingAddressSnapshot ?? null,
    notes: notes ?? null,
    status: ORDER_STATUS.PENDING,
  });

  return order;
};

// Set/replace the shipping address on a pending order and recompute
// shipping + tax + total (destination country drives the tax rate).
const setOrderAddress = async (buyerId, orderId, shippingAddressSnapshot) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  if (!order.buyerId.equals(buyerId)) throw new AppError('Not authorized', HTTP_STATUS.FORBIDDEN);
  if (order.isPaid) throw new AppError('Order is already paid', HTTP_STATUS.CONFLICT);

  const { shippingCost, taxAmount, totalAmount } = await computeCharges({
    sellerId: order.sellerId,
    subtotal: order.subtotal,
    country: shippingAddressSnapshot?.country ?? null,
  });

  order.shippingAddressSnapshot = shippingAddressSnapshot;
  order.shippingCost = shippingCost;
  order.taxAmount = taxAmount;
  order.totalAmount = totalAmount;
  await order.save();
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
  if (status === ORDER_STATUS.COMPLETED) order.completedAt = new Date();
  if (status === ORDER_STATUS.CANCELLED) {
    order.cancelledAt = new Date();
    order.cancelReason = cancelReason ?? 'Cancelled by seller';
  }

  await order.save();

  // Delivery releases the escrowed funds to the seller's available balance.
  if (status === ORDER_STATUS.DELIVERED && order.isPaid) {
    try {
      await paymentService.releaseEscrow(order._id);
    } catch (err) {
      // Don't fail the status update if escrow release hiccups; it can be retried.
    }
  }

  return order;
};

// Buyer confirms receipt of a delivered order → terminal `completed` state.
// Also ensures escrow is released (in case delivery release was retried/missed).
const completeOrder = async (buyerId, orderId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  if (!order.buyerId.equals(buyerId)) throw new AppError('Not authorized', HTTP_STATUS.FORBIDDEN);
  if (order.status !== ORDER_STATUS.DELIVERED) {
    throw new AppError('Only delivered orders can be marked completed', HTTP_STATUS.CONFLICT);
  }

  order.status = ORDER_STATUS.COMPLETED;
  order.completedAt = new Date();
  await order.save();

  if (order.isPaid) {
    try {
      await paymentService.releaseEscrow(order._id);
    } catch (err) {
      // Escrow may already be released on delivery; ignore.
    }
  }

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

module.exports = { createOrder, setOrderAddress, getBuyerOrders, getSellerOrders, getOrder, updateOrderStatus, completeOrder, cancelOrder };
