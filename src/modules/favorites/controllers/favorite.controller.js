const { success } = require('../../../utils/apiResponse');
const svc = require('../services/favorite.service');

const toggle = async (req, res, next) => {
  try {
    const result = await svc.toggleFavorite(req.user._id, req.params.productId);
    return success(res, result, result.favorited ? 'Added to wishlist' : 'Removed from wishlist');
  } catch (err) {
    next(err);
  }
};

const list = async (req, res, next) => {
  try {
    const result = await svc.listFavorites(req.user._id, req.query);
    return success(res, result, 'Wishlist');
  } catch (err) {
    next(err);
  }
};

module.exports = { toggle, list };
