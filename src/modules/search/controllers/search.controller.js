const { success } = require('../../../utils/apiResponse');
const svc = require('../services/search.service');

const search = async (req, res, next) => {
  try {
    const results = await svc.search(req.query);
    return success(res, results, 'Search results');
  } catch (err) {
    next(err);
  }
};

module.exports = { search };
