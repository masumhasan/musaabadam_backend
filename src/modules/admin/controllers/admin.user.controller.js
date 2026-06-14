const adminUserService = require('../services/admin.user.service');
const { success } = require('../../../utils/apiResponse');

const meta = (req) => ({ ipAddress: req.ip, userAgent: req.headers['user-agent'] });

const list = async (req, res, next) => {
  try {
    const data = await adminUserService.listUsers(req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const user = await adminUserService.getUser(req.params.userId);
    return success(res, user);
  } catch (err) { next(err); }
};

const suspend = async (req, res, next) => {
  try {
    const user = await adminUserService.suspendUser(req.params.userId, req.admin._id, req.body, meta(req));
    return success(res, user, 'User suspended');
  } catch (err) { next(err); }
};

const ban = async (req, res, next) => {
  try {
    const user = await adminUserService.banUser(req.params.userId, req.admin._id, req.body, meta(req));
    return success(res, user, 'User banned');
  } catch (err) { next(err); }
};

const activate = async (req, res, next) => {
  try {
    const user = await adminUserService.activateUser(req.params.userId, req.admin._id, meta(req));
    return success(res, user, 'User activated');
  } catch (err) { next(err); }
};

module.exports = { list, getOne, suspend, ban, activate };
