const adminAdminService = require('../services/admin.admin.service');
const { success, created } = require('../../../utils/apiResponse');

const meta = (req) => ({ ipAddress: req.ip, userAgent: req.headers['user-agent'] });

const list = async (req, res, next) => {
  try {
    const data = await adminAdminService.listAdmins(req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const admin = await adminAdminService.createAdmin(req.body, req.admin._id, meta(req));
    return created(res, admin, 'Admin created');
  } catch (err) { next(err); }
};

const toggleActive = async (req, res, next) => {
  try {
    const isActive = req.params.action === 'activate';
    const admin = await adminAdminService.toggleAdminActive(req.params.adminId, isActive, req.admin._id, meta(req));
    return success(res, admin, isActive ? 'Admin activated' : 'Admin deactivated');
  } catch (err) { next(err); }
};

module.exports = { list, create, toggleActive };
