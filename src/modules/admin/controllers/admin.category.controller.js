const categorySvc = require('../services/admin.category.service');
const { success, created } = require('../../../utils/apiResponse');

const list = async (req, res, next) => {
  try {
    const { parentId, page, limit } = req.query;
    const data = await categorySvc.listCategories({ parentId, page, limit });
    return success(res, data);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const category = await categorySvc.createCategory(req.body);
    return created(res, { category }, 'Category created');
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const category = await categorySvc.updateCategory(req.params.categoryId, req.body);
    return success(res, { category }, 'Category updated');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await categorySvc.deleteCategory(req.params.categoryId);
    return success(res, null, 'Category deleted');
  } catch (err) { next(err); }
};

module.exports = { list, create, update, remove };
