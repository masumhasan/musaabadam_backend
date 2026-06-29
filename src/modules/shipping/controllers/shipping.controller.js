const { success, created } = require('../../../utils/apiResponse');
const svc = require('../services/shipping.service');

const listProfiles = async (req, res, next) => {
  try {
    const profiles = await svc.listProfiles(req.user._id);
    return success(res, { profiles }, 'Shipping profiles');
  } catch (err) {
    next(err);
  }
};

const createProfile = async (req, res, next) => {
  try {
    const profile = await svc.createProfile(req.user._id, req.body);
    return created(res, { profile }, 'Shipping profile created');
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const profile = await svc.updateProfile(req.user._id, req.params.profileId, req.body);
    return success(res, { profile }, 'Shipping profile updated');
  } catch (err) {
    next(err);
  }
};

const removeProfile = async (req, res, next) => {
  try {
    const result = await svc.deleteProfile(req.user._id, req.params.profileId);
    return success(res, result, 'Shipping profile removed');
  } catch (err) {
    next(err);
  }
};

const estimate = async (req, res, next) => {
  try {
    const result = await svc.estimateForProduct(req.params.productId, req.query);
    return success(res, result, 'Shipping estimate');
  } catch (err) {
    next(err);
  }
};

const generateLabel = async (req, res, next) => {
  try {
    const result = await svc.generateLabel(req.user._id, req.params.orderId, req.body);
    return created(res, result, 'Label generated');
  } catch (err) {
    next(err);
  }
};

const track = async (req, res, next) => {
  try {
    const result = await svc.trackShipment(req.params.orderId, req.user._id);
    return success(res, result, 'Tracking');
  } catch (err) {
    next(err);
  }
};

module.exports = { listProfiles, createProfile, updateProfile, removeProfile, estimate, generateLabel, track };
