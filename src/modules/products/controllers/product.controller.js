const productService = require('../services/product.service');
const Category = require('../../../models/Category');
const { success, created } = require('../../../utils/apiResponse');

const create = async (req, res, next) => {
  try {
    const product = await productService.createProduct(req.user._id, req.body);
    return created(res, product, 'Product created');
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const product = await productService.updateProduct(req.user._id, req.params.productId, req.body);
    return success(res, product, 'Product updated');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await productService.deleteProduct(req.user._id, req.params.productId);
    return success(res, null, 'Product deleted');
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const product = await productService.getProduct(req.params.productId);
    return success(res, product);
  } catch (err) { next(err); }
};

const list = async (req, res, next) => {
  try {
    const { page, limit, ...filters } = req.query;
    const data = await productService.getPublicProducts(filters, { page, limit });
    return success(res, data);
  } catch (err) { next(err); }
};

const inventory = async (req, res, next) => {
  try {
    const data = await productService.getSellerInventory(req.user._id, req.query);
    return success(res, data);
  } catch (err) { next(err); }
};

const publish = async (req, res, next) => {
  try {
    const product = await productService.publishProduct(req.user._id, req.params.productId);
    return success(res, product, 'Product published');
  } catch (err) { next(err); }
};

const deactivate = async (req, res, next) => {
  try {
    const product = await productService.deactivateProduct(req.user._id, req.params.productId);
    return success(res, product, 'Product deactivated');
  } catch (err) { next(err); }
};

const listCategories = async (req, res, next) => {
  try {
    const query = { isActive: true };
    const { parentId } = req.query;
    if (parentId) {
      query.parentId = parentId;
    } else {
      // no parentId → return top-level categories only
      query.parentId = null;
    }
    const categories = await Category.find(query).sort({ sortOrder: 1, name: 1 });
    return success(res, categories);
  } catch (err) { next(err); }
};

module.exports = { create, update, remove, getOne, list, inventory, publish, deactivate, listCategories };
