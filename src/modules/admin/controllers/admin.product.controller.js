const productSvc = require('../services/admin.product.service');
const { success } = require('../../../utils/apiResponse');

const list = async (req, res, next) => {
  try {
    const { status, listingType, sellerId, search, page, limit } = req.query;
    const data = await productSvc.listProducts({ status, listingType, sellerId, search, page, limit });
    return success(res, data);
  } catch (err) { next(err); }
};

const deactivate = async (req, res, next) => {
  try {
    const product = await productSvc.deactivateProduct(req.params.productId);
    return success(res, { product }, 'Product deactivated');
  } catch (err) { next(err); }
};

const activate = async (req, res, next) => {
  try {
    const product = await productSvc.activateProduct(req.params.productId);
    return success(res, { product }, 'Product activated');
  } catch (err) { next(err); }
};

module.exports = { list, deactivate, activate };
