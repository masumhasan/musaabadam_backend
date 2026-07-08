const PaymentMethod = require('../../../models/PaymentMethod');
const Payment = require('../../../models/Payment');
const Wallet = require('../../../models/Wallet');
const LedgerEntry = require('../../../models/LedgerEntry');
const Payout = require('../../../models/Payout');
const User = require('../../../models/User');
const Order = require('../../../models/Order');
const Product = require('../../../models/Product');
const { ORDER_STATUS } = require('../../../models/Order');
const { PRODUCT_STATUS, LISTING_TYPES } = require('../../../config/constants');
const provider = require('../../../utils/paymentProvider');
const { AppError } = require('../../../middleware/errorHandler');
const {
  HTTP_STATUS,
  PAYMENT_STATUS,
  ESCROW_STATUS,
  PAYOUT_STATUS,
  LEDGER_TYPE,
  PAYMENT,
} = require('../../../config/constants');

const round2 = (n) => Math.round(n * 100) / 100;

// ─── Wallet helpers ───────────────────────────────────────────────────────────

const getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) wallet = await Wallet.create({ userId });
  return wallet;
};

const syncUserBalance = async (userId, available) => {
  await User.updateOne({ _id: userId }, { $set: { walletBalance: available } });
};

// Apply a movement to a wallet bucket and record an immutable ledger entry.
const applyLedger = async (userId, { type, amount, bucket, orderId, paymentId, payoutId, description }) => {
  const wallet = await getOrCreateWallet(userId);
  wallet[bucket] = round2(Math.max(0, (wallet[bucket] || 0) + amount));

  if (type === LEDGER_TYPE.ESCROW_RELEASE && amount > 0) wallet.lifetimeEarned = round2(wallet.lifetimeEarned + amount);
  if (type === LEDGER_TYPE.PAYOUT && amount < 0) wallet.lifetimePaidOut = round2(wallet.lifetimePaidOut - amount);
  await wallet.save();

  await syncUserBalance(userId, wallet.available);

  await LedgerEntry.create({
    userId,
    type,
    amount,
    bucket,
    orderId: orderId ?? null,
    paymentId: paymentId ?? null,
    payoutId: payoutId ?? null,
    description: description ?? null,
  });

  return wallet;
};

// ─── Payment methods ─────────────────────────────────────────────────────────

const listPaymentMethods = async (userId) =>
  PaymentMethod.find({ userId, deletedAt: null }).sort({ isDefault: -1, createdAt: -1 });

const addPaymentMethod = async (userId, { card, providerPaymentMethodId, makeDefault }) => {
  const attached = await provider.attachPaymentMethod({ card, providerPaymentMethodId });

  if (makeDefault) {
    await PaymentMethod.updateMany({ userId, deletedAt: null }, { $set: { isDefault: false } });
  }
  const existingCount = await PaymentMethod.countDocuments({ userId, deletedAt: null });

  return PaymentMethod.create({
    userId,
    provider: provider.name,
    providerPaymentMethodId: attached.id,
    brand: attached.brand,
    last4: attached.last4,
    expMonth: attached.expMonth,
    expYear: attached.expYear,
    isDefault: makeDefault || existingCount === 0,
  });
};

const deletePaymentMethod = async (userId, methodId) => {
  const pm = await PaymentMethod.findOne({ _id: methodId, userId, deletedAt: null });
  if (!pm) throw new AppError('Payment method not found', HTTP_STATUS.NOT_FOUND);
  pm.deletedAt = new Date();
  pm.isDefault = false;
  await pm.save();
  return { id: String(pm._id) };
};

// ─── Checkout / escrow ──────────────────────────────────────────────────────

// Create a payment intent for an order. Returns the client secret for the app
// Create a payment intent for an order. Returns the client secret for the app
// to confirm (or the app can confirm server-side via confirmPayment).
const createCheckout = async (buyerId, orderId, { paymentMethodId, couponId } = {}) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  if (!order.buyerId.equals(buyerId)) throw new AppError('Not authorized', HTTP_STATUS.FORBIDDEN);
  if (order.isPaid) throw new AppError('Order is already paid', HTTP_STATUS.CONFLICT);
  if (![ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED].includes(order.status)) {
    throw new AppError('Order cannot be paid in its current state', HTTP_STATUS.CONFLICT);
  }

  let pm = null;
  if (paymentMethodId) {
    pm = await PaymentMethod.findOne({ _id: paymentMethodId, userId: buyerId, deletedAt: null });
    if (!pm) throw new AppError('Payment method not found', HTTP_STATUS.NOT_FOUND);
  }

  let coupon = null;
  let discountAmount = 0;
  if (couponId) {
    const Reward = require('../../../models/Reward');
    coupon = await Reward.findOne({ _id: couponId, userId: buyerId, isUsed: false });
    if (!coupon) throw new AppError('Coupon not found or already used', HTTP_STATUS.NOT_FOUND);
    if (!coupon.isValidForOrder(order.totalAmount)) {
      throw new AppError('Coupon is expired or order total does not meet minimum order value', HTTP_STATUS.BAD_REQUEST);
    }

    if (coupon.discountType === 'fixed') {
      discountAmount = Math.min(coupon.discountValue, order.totalAmount);
    } else if (coupon.discountType === 'percentage') {
      discountAmount = round2((order.totalAmount * coupon.discountValue) / 100);
    }
  }

  const originalAmount = round2(order.totalAmount);
  const amount = round2(Math.max(0, originalAmount - discountAmount));
  const platformFee = round2((amount * PAYMENT.PLATFORM_FEE_PERCENT) / 100);
  const sellerNet = round2(amount - platformFee);

  const intent = await provider.createPaymentIntent({
    amount,
    currency: PAYMENT.CURRENCY,
    metadata: { orderId: String(order._id), buyerId: String(buyerId) },
    paymentMethodId: pm?.providerPaymentMethodId,
  });

  // Reuse an existing pending payment for this order if present.
  let payment = await Payment.findOne({ orderId: order._id, status: PAYMENT_STATUS.REQUIRES_PAYMENT });
  if (payment) {
    payment.providerIntentId = intent.id;
    payment.amount = amount;
    payment.platformFee = platformFee;
    payment.sellerNet = sellerNet;
    payment.paymentMethodId = pm?._id ?? null;
    payment.couponId = coupon?._id ?? null;
    payment.discountAmount = discountAmount;
    await payment.save();
  } else {
    payment = await Payment.create({
      orderId: order._id,
      buyerId,
      sellerId: order.sellerId,
      provider: provider.name,
      providerIntentId: intent.id,
      paymentMethodId: pm?._id ?? null,
      couponId: coupon?._id ?? null,
      discountAmount,
      currency: PAYMENT.CURRENCY,
      amount,
      platformFee,
      sellerNet,
      status: PAYMENT_STATUS.REQUIRES_PAYMENT,
      escrowStatus: ESCROW_STATUS.NONE,
    });
  }

  return { payment, clientSecret: intent.clientSecret, intentId: intent.id };
};

// Confirm the payment, capture funds into escrow, and credit the seller's
// pending balance. Marks the order confirmed + paid.
const confirmPayment = async (buyerId, orderId, { paymentMethodId } = {}) => {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  if (!order.buyerId.equals(buyerId)) throw new AppError('Not authorized', HTTP_STATUS.FORBIDDEN);
  if (order.isPaid) throw new AppError('Order is already paid', HTTP_STATUS.CONFLICT);

  const payment = await Payment.findOne({ orderId: order._id, status: PAYMENT_STATUS.REQUIRES_PAYMENT }).sort({
    createdAt: -1,
  });
  if (!payment) throw new AppError('No pending payment for this order. Start checkout first.', HTTP_STATUS.CONFLICT);

  let pmRef = null;
  if (paymentMethodId) {
    const pm = await PaymentMethod.findOne({ _id: paymentMethodId, userId: buyerId, deletedAt: null });
    pmRef = pm?.providerPaymentMethodId;
  }

  const result = await provider.confirmPaymentIntent({ intentId: payment.providerIntentId, paymentMethodId: pmRef });

  if (result.status !== 'succeeded') {
    payment.status = PAYMENT_STATUS.FAILED;
    payment.failureReason = `Provider status: ${result.status}`;
    await payment.save();
    throw new AppError('Payment was not successful', HTTP_STATUS.BAD_REQUEST);
  }

  payment.status = PAYMENT_STATUS.SUCCEEDED;
  payment.escrowStatus = ESCROW_STATUS.HELD;
  payment.capturedAt = new Date();
  await payment.save();

  if (payment.couponId) {
    const Reward = require('../../../models/Reward');
    await Reward.updateOne({ _id: payment.couponId }, { $set: { isUsed: true, usedAt: new Date() } });
  }

  // Funds held in escrow → seller's pending balance.
  await applyLedger(order.sellerId, {
    type: LEDGER_TYPE.ESCROW_HOLD,
    amount: payment.sellerNet,
    bucket: 'pending',
    orderId: order._id,
    paymentId: payment._id,
    description: `Escrow hold for order ${order._id}`,
  });

  order.isPaid = true;
  order.paidAt = new Date();
  order.paymentIntentId = payment.providerIntentId;
  order.paymentMethod = provider.name;
  if (order.status === ORDER_STATUS.PENDING) order.status = ORDER_STATUS.CONFIRMED;
  await order.save();

  // Reduce inventory for non-auction items and broadcast buy-now / sold-out to
  // the live room. (Auction winners already had quantitySold set at close.)
  await settleInventoryAndBroadcast(order);

  return { payment, order };
};

// Decrement stock for buy-now items and emit realtime events to the stream room.
const settleInventoryAndBroadcast = async (order) => {
  // Lazy require avoids a socket <-> payment require cycle at module load.
  // eslint-disable-next-line global-require
  const { getIO } = require('../../../socket');
  const io = getIO();
  const room = order.streamId ? `stream:${order.streamId}` : null;

  for (const item of order.items) {
    const product = await Product.findById(item.productId);
    if (!product || product.listingType === LISTING_TYPES.AUCTION) continue;

    product.quantitySold = Math.min(product.quantity, (product.quantitySold || 0) + item.quantity);
    const soldOut = product.quantitySold >= product.quantity;
    if (soldOut) product.status = PRODUCT_STATUS.SOLD_OUT;
    await product.save();

    if (room && io) {
      io.to(room).emit('buy-now-purchase', {
        streamId: String(order.streamId),
        productId: String(product._id),
        title: product.title,
        quantitySold: product.quantitySold,
        quantity: product.quantity,
      });
      if (soldOut) {
        io.to(room).emit('product-sold-out', {
          streamId: String(order.streamId),
          productId: String(product._id),
        });
      }
    }
  }
};

// Release escrow to the seller's available balance. Invoked when an order is
// marked delivered (buyer protection window can gate this later).
const releaseEscrow = async (orderId) => {
  const payment = await Payment.findOne({ orderId, escrowStatus: ESCROW_STATUS.HELD });
  if (!payment) return null;

  // Move from pending → available.
  await applyLedger(payment.sellerId, {
    type: LEDGER_TYPE.ESCROW_HOLD,
    amount: -payment.sellerNet,
    bucket: 'pending',
    orderId,
    paymentId: payment._id,
    description: `Escrow release (out of pending) for order ${orderId}`,
  });
  await applyLedger(payment.sellerId, {
    type: LEDGER_TYPE.ESCROW_RELEASE,
    amount: payment.sellerNet,
    bucket: 'available',
    orderId,
    paymentId: payment._id,
    description: `Escrow release for order ${orderId}`,
  });

  payment.escrowStatus = ESCROW_STATUS.RELEASED;
  payment.releasedAt = new Date();
  await payment.save();
  return payment;
};

// Refund a paid order. Pulls funds back from the seller's pending/available
// balance depending on whether escrow was already released.
const refundOrderPayment = async (orderId, { amount, reason, requesterId } = {}) => {
  const payment = await Payment.findOne({ orderId, status: { $in: [PAYMENT_STATUS.SUCCEEDED, PAYMENT_STATUS.PARTIALLY_REFUNDED] } });
  if (!payment) throw new AppError('No captured payment to refund', HTTP_STATUS.NOT_FOUND);
  if (requesterId && !payment.sellerId.equals(requesterId)) {
    throw new AppError('Only the seller can refund this order', HTTP_STATUS.FORBIDDEN);
  }

  const refundAmount = round2(amount != null ? Math.min(amount, payment.amount - payment.refundedAmount) : payment.amount - payment.refundedAmount);
  if (refundAmount <= 0) throw new AppError('Nothing left to refund', HTTP_STATUS.CONFLICT);

  await provider.refund({ intentId: payment.providerIntentId, amount: refundAmount });

  // Claw back the seller's share proportionally from the right bucket.
  const sellerShare = round2(refundAmount * (payment.sellerNet / payment.amount));
  const bucket = payment.escrowStatus === ESCROW_STATUS.RELEASED ? 'available' : 'pending';
  await applyLedger(payment.sellerId, {
    type: LEDGER_TYPE.REFUND,
    amount: -sellerShare,
    bucket,
    orderId,
    paymentId: payment._id,
    description: `Refund clawback for order ${orderId}`,
  });

  payment.refundedAmount = round2(payment.refundedAmount + refundAmount);
  payment.status = payment.refundedAmount >= payment.amount ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_REFUNDED;
  if (payment.status === PAYMENT_STATUS.REFUNDED) payment.escrowStatus = ESCROW_STATUS.REFUNDED;
  payment.refundedAt = new Date();
  if (reason) payment.failureReason = reason;
  await payment.save();

  if (payment.status === PAYMENT_STATUS.REFUNDED) {
    await Order.updateOne(
      { _id: orderId },
      { $set: { status: ORDER_STATUS.REFUNDED } }
    );
  }

  return payment;
};

// ─── Wallet read + payouts ───────────────────────────────────────────────────

const getWallet = async (userId) => {
  const wallet = await getOrCreateWallet(userId);
  return wallet;
};

const getLedger = async (userId, { page = 1, limit = 20 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);
  const [entries, total] = await Promise.all([
    LedgerEntry.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    LedgerEntry.countDocuments({ userId }),
  ]);
  return { entries, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
};

const requestPayout = async (sellerId, { amount, destination } = {}) => {
  const wallet = await getOrCreateWallet(sellerId);
  const payoutAmount = round2(amount != null ? amount : wallet.available);

  if (payoutAmount < PAYMENT.MIN_PAYOUT) {
    throw new AppError(`Minimum payout is ${PAYMENT.MIN_PAYOUT}`, HTTP_STATUS.BAD_REQUEST);
  }
  if (payoutAmount > wallet.available) {
    throw new AppError('Payout exceeds available balance', HTTP_STATUS.CONFLICT);
  }

  const payout = await Payout.create({
    sellerId,
    amount: payoutAmount,
    currency: PAYMENT.CURRENCY,
    provider: provider.name,
    destination: destination ?? null,
    status: PAYOUT_STATUS.PROCESSING,
  });

  // Reserve the funds out of available immediately.
  await applyLedger(sellerId, {
    type: LEDGER_TYPE.PAYOUT,
    amount: -payoutAmount,
    bucket: 'available',
    payoutId: payout._id,
    description: `Payout ${payout._id}`,
  });

  try {
    const result = await provider.createPayout({
      amount: payoutAmount,
      currency: PAYMENT.CURRENCY,
      destination: destination ?? undefined,
    });
    payout.providerPayoutId = result.id;
    payout.status = result.status === 'paid' ? PAYOUT_STATUS.PAID : PAYOUT_STATUS.PROCESSING;
    payout.processedAt = result.status === 'paid' ? new Date() : undefined;
    await payout.save();
  } catch (err) {
    // Roll the reserved funds back on provider failure.
    await applyLedger(sellerId, {
      type: LEDGER_TYPE.ADJUSTMENT,
      amount: payoutAmount,
      bucket: 'available',
      payoutId: payout._id,
      description: `Payout ${payout._id} failed — refunded to balance`,
    });
    payout.status = PAYOUT_STATUS.FAILED;
    payout.failureReason = err.message;
    await payout.save();
    throw new AppError('Payout failed, balance restored', HTTP_STATUS.BAD_REQUEST);
  }

  return payout;
};

// ─── Seller payout account (Stripe Connect / mock) ───────────────────────────

// Ensure the seller has a connected payout account and return an onboarding link.
const startPayoutOnboarding = async (sellerId) => {
  const user = await User.findById(sellerId).select('email sellerProfile');
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);

  let accountId = user.sellerProfile?.stripeAccountId;
  if (!accountId) {
    const account = await provider.createConnectAccount({ email: user.email });
    accountId = account.id;
    user.sellerProfile = user.sellerProfile || {};
    user.sellerProfile.stripeAccountId = accountId;
    await user.save();
  }

  const link = await provider.createAccountLink({ accountId });
  return { accountId, onboardingUrl: link.url, provider: provider.name };
};

// Report whether the seller can receive payouts yet.
const getPayoutAccount = async (sellerId) => {
  const user = await User.findById(sellerId).select('sellerProfile');
  const accountId = user?.sellerProfile?.stripeAccountId || null;
  if (!accountId) return { connected: false, payoutsEnabled: false, accountId: null };

  let status = { chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false };
  try {
    status = await provider.getAccountStatus({ accountId });
  } catch {
    // Provider unavailable — report as pending.
  }
  return { connected: true, accountId, ...status };
};

const listPayouts = async (sellerId, { page = 1, limit = 20 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);
  const [payouts, total] = await Promise.all([
    Payout.find({ sellerId }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Payout.countDocuments({ sellerId }),
  ]);
  return { payouts, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
};

module.exports = {
  listPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  createCheckout,
  confirmPayment,
  releaseEscrow,
  refundOrderPayment,
  getWallet,
  getLedger,
  requestPayout,
  listPayouts,
  startPayoutOnboarding,
  getPayoutAccount,
};
