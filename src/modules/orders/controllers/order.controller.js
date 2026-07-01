const { HTTP_STATUS } = require('../../../config/constants');
const svc = require('../services/order.service');

const create = async (req, res, next) => {
  try {
    const order = await svc.createOrder(req.user._id, req.body);
    res.status(HTTP_STATUS.CREATED).json({ success: true, data: { order } });
  } catch (err) {
    next(err);
  }
};

const myOrders = async (req, res, next) => {
  try {
    const result = await svc.getBuyerOrders(req.user._id, req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const sellerOrders = async (req, res, next) => {
  try {
    const result = await svc.getSellerOrders(req.user._id, req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const detail = async (req, res, next) => {
  try {
    const order = await svc.getOrder(req.params.orderId, req.user._id);
    res.json({ success: true, data: { order } });
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const order = await svc.updateOrderStatus(req.user._id, req.params.orderId, req.body);
    res.json({ success: true, data: { order } });
  } catch (err) {
    next(err);
  }
};

const setAddress = async (req, res, next) => {
  try {
    const order = await svc.setOrderAddress(req.user._id, req.params.orderId, req.body.shippingAddressSnapshot);
    res.json({ success: true, data: { order } });
  } catch (err) {
    next(err);
  }
};

const complete = async (req, res, next) => {
  try {
    const order = await svc.completeOrder(req.user._id, req.params.orderId);
    res.json({ success: true, data: { order } });
  } catch (err) {
    next(err);
  }
};

const cancel = async (req, res, next) => {
  try {
    const order = await svc.cancelOrder(req.user._id, req.params.orderId, req.body);
    res.json({ success: true, data: { order } });
  } catch (err) {
    next(err);
  }
};

module.exports = { create, myOrders, sellerOrders, detail, updateStatus, setAddress, complete, cancel };
