const { success, created } = require('../../../utils/apiResponse');
const svc = require('../services/payment.service');

const listMethods = async (req, res, next) => {
  try {
    const methods = await svc.listPaymentMethods(req.user._id);
    return success(res, { methods }, 'Payment methods');
  } catch (err) {
    next(err);
  }
};

const addMethod = async (req, res, next) => {
  try {
    const method = await svc.addPaymentMethod(req.user._id, req.body);
    return created(res, { method }, 'Payment method added');
  } catch (err) {
    next(err);
  }
};

const removeMethod = async (req, res, next) => {
  try {
    const result = await svc.deletePaymentMethod(req.user._id, req.params.methodId);
    return success(res, result, 'Payment method removed');
  } catch (err) {
    next(err);
  }
};

const setDefaultMethod = async (req, res, next) => {
  try {
    const method = await svc.setDefaultPaymentMethod(req.user._id, req.params.methodId);
    return success(res, { method }, 'Default payment method updated');
  } catch (err) {
    next(err);
  }
};

const checkout = async (req, res, next) => {
  try {
    const result = await svc.createCheckout(req.user._id, req.params.orderId, req.body);
    return created(res, result, 'Checkout started');
  } catch (err) {
    next(err);
  }
};

const confirm = async (req, res, next) => {
  try {
    const result = await svc.confirmPayment(req.user._id, req.params.orderId, req.body);
    return success(res, result, 'Payment confirmed');
  } catch (err) {
    next(err);
  }
};

const refund = async (req, res, next) => {
  try {
    const payment = await svc.refundOrderPayment(req.params.orderId, { ...req.body, requesterId: req.user._id });
    return success(res, { payment }, 'Refund processed');
  } catch (err) {
    next(err);
  }
};

const wallet = async (req, res, next) => {
  try {
    const result = await svc.getWallet(req.user._id);
    return success(res, { wallet: result }, 'Wallet');
  } catch (err) {
    next(err);
  }
};

const ledger = async (req, res, next) => {
  try {
    const result = await svc.getLedger(req.user._id, req.query);
    return success(res, result, 'Ledger');
  } catch (err) {
    next(err);
  }
};

const requestPayout = async (req, res, next) => {
  try {
    const payout = await svc.requestPayout(req.user._id, req.body);
    return created(res, { payout }, 'Payout requested');
  } catch (err) {
    next(err);
  }
};

const listPayouts = async (req, res, next) => {
  try {
    const result = await svc.listPayouts(req.user._id, req.query);
    return success(res, result, 'Payouts');
  } catch (err) {
    next(err);
  }
};

const payoutAccount = async (req, res, next) => {
  try {
    const account = await svc.getPayoutAccount(req.user._id);
    return success(res, { account }, 'Payout account');
  } catch (err) {
    next(err);
  }
};

const onboardPayoutAccount = async (req, res, next) => {
  try {
    const result = await svc.startPayoutOnboarding(req.user._id);
    return success(res, result, 'Payout onboarding');
  } catch (err) {
    next(err);
  }
};

const sendTip = async (req, res, next) => {
  try {
    const result = await svc.processTip(req.user._id, req.body);
    return created(res, { tip: result }, 'Tip sent successfully');
  } catch (err) {
    next(err);
  }
};

const getReceivedTips = async (req, res, next) => {
  try {
    const result = await svc.getReceivedTips(req.user._id);
    return success(res, { tips: result }, 'Received tips retrieved');
  } catch (err) {
    next(err);
  }
};

const getSentTips = async (req, res, next) => {
  try {
    const result = await svc.getSentTips(req.user._id);
    return success(res, { tips: result }, 'Sent tips retrieved');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listMethods,
  addMethod,
  removeMethod,
  setDefaultMethod,
  checkout,
  confirm,
  refund,
  wallet,
  ledger,
  requestPayout,
  listPayouts,
  payoutAccount,
  onboardPayoutAccount,
  sendTip,
  getReceivedTips,
  getSentTips,
};
