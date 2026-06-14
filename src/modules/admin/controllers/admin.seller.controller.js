const adminSellerService = require('../services/admin.seller.service');
const { success } = require('../../../utils/apiResponse');

const meta = (req) => ({ ipAddress: req.ip, userAgent: req.headers['user-agent'] });

const list = async (req, res, next) => {
  try {
    const data = await adminSellerService.listSellers(req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const approve = async (req, res, next) => {
  try {
    const user = await adminSellerService.approveSeller(req.params.userId, req.admin._id, meta(req));
    return success(res, user, 'Seller approved');
  } catch (err) { next(err); }
};

const reject = async (req, res, next) => {
  try {
    const user = await adminSellerService.rejectSeller(req.params.userId, req.admin._id, req.body, meta(req));
    return success(res, user, 'Seller application rejected');
  } catch (err) { next(err); }
};

const requestInfo = async (req, res, next) => {
  try {
    const user = await adminSellerService.requestMoreInfo(req.params.userId, req.admin._id, req.body, meta(req));
    return success(res, user, 'Seller notified to provide more information');
  } catch (err) { next(err); }
};

module.exports = { list, approve, reject, requestInfo };
