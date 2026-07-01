const { success, created } = require('../../../utils/apiResponse');
const svc = require('../services/review.service');

const create = async (req, res, next) => {
  try {
    const result = await svc.createReview(req.user._id, req.body);
    return created(res, result, 'Review submitted');
  } catch (err) {
    next(err);
  }
};

const listForSeller = async (req, res, next) => {
  try {
    const result = await svc.listSellerReviews(req.params.sellerId, req.query);
    return success(res, result, 'Seller reviews');
  } catch (err) {
    next(err);
  }
};

const reviewable = async (req, res, next) => {
  try {
    const orders = await svc.getReviewableOrders(req.user._id);
    return success(res, { orders }, 'Reviewable orders');
  } catch (err) {
    next(err);
  }
};

module.exports = { create, listForSeller, reviewable };
