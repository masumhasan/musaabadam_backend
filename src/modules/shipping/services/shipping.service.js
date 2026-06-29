const crypto = require('crypto');
const ShippingProfile = require('../../../models/ShippingProfile');
const { CARRIERS } = require('../../../models/ShippingProfile');
const Order = require('../../../models/Order');
const { ORDER_STATUS } = require('../../../models/Order');
const Product = require('../../../models/Product');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS } = require('../../../config/constants');

// ─── Shipping profiles (seller) ───────────────────────────────────────────────

const listProfiles = (sellerId) =>
  ShippingProfile.find({ sellerId, deletedAt: null }).sort({ isDefault: -1, createdAt: -1 });

const createProfile = async (sellerId, data) => {
  if (data.isDefault) {
    await ShippingProfile.updateMany({ sellerId, deletedAt: null }, { $set: { isDefault: false } });
  }
  const count = await ShippingProfile.countDocuments({ sellerId, deletedAt: null });
  return ShippingProfile.create({
    ...data,
    sellerId,
    isDefault: data.isDefault || count === 0,
  });
};

const updateProfile = async (sellerId, profileId, data) => {
  const profile = await ShippingProfile.findOne({ _id: profileId, sellerId, deletedAt: null });
  if (!profile) throw new AppError('Shipping profile not found', HTTP_STATUS.NOT_FOUND);

  if (data.isDefault) {
    await ShippingProfile.updateMany(
      { sellerId, deletedAt: null, _id: { $ne: profileId } },
      { $set: { isDefault: false } }
    );
  }
  Object.assign(profile, data);
  await profile.save();
  return profile;
};

const deleteProfile = async (sellerId, profileId) => {
  const profile = await ShippingProfile.findOne({ _id: profileId, sellerId, deletedAt: null });
  if (!profile) throw new AppError('Shipping profile not found', HTTP_STATUS.NOT_FOUND);
  profile.deletedAt = new Date();
  profile.isDefault = false;
  await profile.save();
  return { id: String(profile._id) };
};

// ─── Rate calculation ─────────────────────────────────────────────────────────

// Resolve the shipping cost for a given profile, order subtotal, weight, and
// destination. Free-shipping threshold and weight tiers are honoured.
const computeRate = (profile, { subtotal = 0, weightKg = 0, international = false } = {}) => {
  if (!profile) return 0;
  if (profile.freeShippingThreshold != null && subtotal >= profile.freeShippingThreshold) return 0;

  if (international) {
    if (profile.domesticOnly) throw new AppError('Seller does not ship internationally', HTTP_STATUS.CONFLICT);
    return profile.internationalRate ?? profile.flatRate;
  }

  if (profile.rateTiers && profile.rateTiers.length > 0) {
    const sorted = [...profile.rateTiers].sort((a, b) => (a.maxWeightKg ?? Infinity) - (b.maxWeightKg ?? Infinity));
    const tier = sorted.find((t) => t.maxWeightKg == null || weightKg <= t.maxWeightKg);
    if (tier) return tier.price;
    return sorted[sorted.length - 1].price;
  }

  return profile.flatRate;
};

// Public estimate: given a product (for weight) and a seller's default profile.
const estimateForProduct = async (productId, { subtotal, international } = {}) => {
  const product = await Product.findOne({ _id: productId, deletedAt: null });
  if (!product) throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);

  const profile = await ShippingProfile.findOne({ sellerId: product.sellerId, deletedAt: null, isDefault: true })
    || await ShippingProfile.findOne({ sellerId: product.sellerId, deletedAt: null });

  const cost = computeRate(profile, {
    subtotal: subtotal != null ? Number(subtotal) : product.price || product.currentHighBid || 0,
    weightKg: product.shippingWeight || 0,
    international: Boolean(international),
  });

  return {
    cost,
    currency: profile?.currency || 'gbp',
    carrier: profile?.carrier || CARRIERS.ROYAL_MAIL,
    handlingDays: profile?.handlingDays ?? 1,
    hasProfile: Boolean(profile),
  };
};

// ─── Labels & tracking (mock carrier — swap for real carrier APIs later) ──────

const genTracking = (carrier) => {
  const code = crypto.randomBytes(5).toString('hex').toUpperCase();
  const prefix = { [CARRIERS.ROYAL_MAIL]: 'RM', [CARRIERS.DPD]: 'DPD', [CARRIERS.EVRI]: 'EVRI', [CARRIERS.UPS]: '1Z' }[carrier] || 'TRK';
  return `${prefix}${code}GB`;
};

// Seller generates a shipping label for one of their orders. Produces a tracking
// number + (mock) label URL and advances the order to "shipped".
const generateLabel = async (sellerId, orderId, { carrier } = {}) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  if (!order.sellerId.equals(sellerId)) throw new AppError('Not authorized', HTTP_STATUS.FORBIDDEN);
  if ([ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED].includes(order.status)) {
    throw new AppError('Cannot ship a cancelled or refunded order', HTTP_STATUS.CONFLICT);
  }
  if (!order.isPaid) throw new AppError('Order must be paid before shipping', HTTP_STATUS.CONFLICT);

  const useCarrier = carrier || CARRIERS.ROYAL_MAIL;
  const tracking = genTracking(useCarrier);

  order.trackingNumber = tracking;
  order.trackingCarrier = useCarrier;
  order.shippedAt = new Date();
  if ([ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING].includes(order.status)) {
    order.status = ORDER_STATUS.SHIPPED;
  }
  await order.save();

  return {
    orderId: String(order._id),
    trackingNumber: tracking,
    carrier: useCarrier,
    labelUrl: `/uploads/labels/${order._id}-${tracking}.pdf`, // mock; real provider returns a hosted PDF
    shippedAt: order.shippedAt,
  };
};

// Mock tracking timeline derived from the order's lifecycle timestamps.
const trackShipment = async (orderId, userId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  const isParty = order.buyerId.equals(userId) || order.sellerId.equals(userId);
  if (!isParty) throw new AppError('Not authorized', HTTP_STATUS.FORBIDDEN);

  const events = [];
  if (order.createdAt) events.push({ status: 'order_placed', label: 'Order placed', at: order.createdAt });
  if (order.paidAt) events.push({ status: 'paid', label: 'Payment confirmed', at: order.paidAt });
  if (order.shippedAt) {
    events.push({ status: 'shipped', label: `Dispatched via ${order.trackingCarrier || 'carrier'}`, at: order.shippedAt });
    events.push({ status: 'in_transit', label: 'In transit', at: order.shippedAt });
  }
  if (order.deliveredAt) events.push({ status: 'delivered', label: 'Delivered', at: order.deliveredAt });

  return {
    orderId: String(order._id),
    status: order.status,
    trackingNumber: order.trackingNumber ?? null,
    carrier: order.trackingCarrier ?? null,
    events,
  };
};

module.exports = {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  computeRate,
  estimateForProduct,
  generateLabel,
  trackShipment,
};
