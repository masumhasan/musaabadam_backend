const svc = require('../services/analytics.service');

const adminOverview = async (req, res, next) => {
  try {
    const data = await svc.getAdminOverview();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const adminRevenueTrend = async (req, res, next) => {
  try {
    const data = await svc.getAdminRevenueTrend(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const sellerOverview = async (req, res, next) => {
  try {
    const data = await svc.getSellerOverview(req.user._id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const sellerRevenueTrend = async (req, res, next) => {
  try {
    const data = await svc.getSellerRevenueTrend(req.user._id, req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = { adminOverview, adminRevenueTrend, sellerOverview, sellerRevenueTrend };
