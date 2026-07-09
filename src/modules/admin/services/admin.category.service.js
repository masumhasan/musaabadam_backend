const Category = require('../../../models/Category');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS } = require('../../../config/constants');

const slugify = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const listCategories = async ({ parentId, page = 1, limit = 50 }) => {
  const query = {};
  if (parentId === 'null') {
    query.parentId = null;
  } else if (parentId) {
    query.parentId = parentId;
  }
  // no parentId param → return all (admin needs to see everything)

  const skip = (Number(page) - 1) * Number(limit);
  const [categories, total] = await Promise.all([
    Category.find(query)
      .populate('parentId', 'name slug')
      .sort({ sortOrder: 1, name: 1 })
      .skip(skip)
      .limit(Number(limit)),
    Category.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / Number(limit));
  return { categories, total, page: Number(page), limit: Number(limit), totalPages };
};

const createCategory = async (data) => {
  const { name, parentId, imageUrl, sortOrder } = data;
  const slug = data.slug ? data.slug : slugify(name);

  const existing = await Category.findOne({ $or: [{ name }, { slug }] });
  if (existing) throw new AppError('Category with this name or slug already exists', HTTP_STATUS.CONFLICT);

  if (parentId) {
    const parent = await Category.findById(parentId);
    if (!parent) throw new AppError('Parent category not found', HTTP_STATUS.NOT_FOUND);
    if (parent.parentId) throw new AppError('Cannot nest more than two levels deep', HTTP_STATUS.BAD_REQUEST);
  }

  return Category.create({
    name,
    slug,
    parentId: parentId || null,
    imageUrl: imageUrl || undefined,
    sortOrder: sortOrder ?? 0,
  });
};

const updateCategory = async (categoryId, data) => {
  const category = await Category.findById(categoryId);
  if (!category) throw new AppError('Category not found', HTTP_STATUS.NOT_FOUND);

  if (data.name && data.name !== category.name) {
    const conflict = await Category.findOne({ name: data.name, _id: { $ne: categoryId } });
    if (conflict) throw new AppError('Category name already in use', HTTP_STATUS.CONFLICT);
  }

  if (data.slug && data.slug !== category.slug) {
    const conflict = await Category.findOne({ slug: data.slug, _id: { $ne: categoryId } });
    if (conflict) throw new AppError('Category slug already in use', HTTP_STATUS.CONFLICT);
  }

  const allowed = ['name', 'slug', 'imageUrl', 'isActive', 'sortOrder', 'parentId'];
  for (const key of allowed) {
    if (key in data) {
      if (key === 'parentId' && !data[key]) {
        category[key] = null;
      } else {
        category[key] = data[key];
      }
    }
  }

  await category.save();
  return category.populate('parentId', 'name slug');
};

const deleteCategory = async (categoryId) => {
  const category = await Category.findById(categoryId);
  if (!category) throw new AppError('Category not found', HTTP_STATUS.NOT_FOUND);

  const childCount = await Category.countDocuments({ parentId: categoryId });
  if (childCount > 0) {
    throw new AppError(
      `Cannot delete: this category has ${childCount} subcategorie(s). Delete or reassign them first.`,
      HTTP_STATUS.CONFLICT
    );
  }

  await category.deleteOne();
};

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };
