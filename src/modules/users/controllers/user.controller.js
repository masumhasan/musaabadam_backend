const userService = require('../services/user.service');
const { success } = require('../../../utils/apiResponse');

const getMyProfile = async (req, res, next) => {
  try {
    const profile = await userService.getProfile(req.user._id);
    return success(res, profile);
  } catch (err) {
    next(err);
  }
};

const getReferralInfo = async (req, res, next) => {
  try {
    const info = await userService.getReferralInfo(req.user._id);
    return success(res, info, 'Referral info');
  } catch (err) {
    next(err);
  }
};

const updateMyProfile = async (req, res, next) => {
  try {
    const profile = await userService.updateProfile(req.user._id, req.body);
    return success(res, profile, 'Profile updated');
  } catch (err) {
    next(err);
  }
};

const getPublicProfile = async (req, res, next) => {
  try {
    const profile = await userService.getPublicProfile(req.params.userId, req.user._id);
    return success(res, profile);
  } catch (err) {
    next(err);
  }
};

const getAddresses = async (req, res, next) => {
  try {
    const addresses = await userService.getAddresses(req.user._id);
    return success(res, addresses);
  } catch (err) {
    next(err);
  }
};

const addAddress = async (req, res, next) => {
  try {
    const addresses = await userService.addAddress(req.user._id, req.body);
    return success(res, addresses, 'Address added');
  } catch (err) {
    next(err);
  }
};

const updateAddress = async (req, res, next) => {
  try {
    const addresses = await userService.updateAddress(req.user._id, req.params.addressId, req.body);
    return success(res, addresses, 'Address updated');
  } catch (err) {
    next(err);
  }
};

const deleteAddress = async (req, res, next) => {
  try {
    const addresses = await userService.deleteAddress(req.user._id, req.params.addressId);
    return success(res, addresses, 'Address deleted');
  } catch (err) {
    next(err);
  }
};

const updateNotificationPreferences = async (req, res, next) => {
  try {
    const prefs = await userService.updateNotificationPreferences(req.user._id, req.body);
    return success(res, prefs, 'Notification preferences updated');
  } catch (err) {
    next(err);
  }
};

const updateAppPreferences = async (req, res, next) => {
  try {
    const prefs = await userService.updateAppPreferences(req.user._id, req.body);
    return success(res, prefs, 'App preferences updated');
  } catch (err) {
    next(err);
  }
};

const applyAsSeller = async (req, res, next) => {
  try {
    const profile = await userService.applyAsSeller(req.user._id, req.body);
    return success(res, profile, 'Seller application submitted successfully');
  } catch (err) {
    next(err);
  }
};

const updateKyc = async (req, res, next) => {
  try {
    const profile = await userService.updateKyc(req.user._id, req.body);
    return success(res, profile, 'KYC documents updated successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = { getMyProfile, getReferralInfo, updateMyProfile, getPublicProfile, getAddresses, addAddress, updateAddress, deleteAddress, updateNotificationPreferences, updateAppPreferences, applyAsSeller, updateKyc };
