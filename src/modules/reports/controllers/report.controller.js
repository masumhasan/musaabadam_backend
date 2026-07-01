const { success, created } = require('../../../utils/apiResponse');
const svc = require('../services/report.service');

// ── User ──
const create = async (req, res, next) => {
  try {
    const report = await svc.createReport(req.user._id, req.body);
    return created(res, { report }, 'Report submitted');
  } catch (err) {
    next(err);
  }
};

// ── Admin ──
const list = async (req, res, next) => {
  try {
    const result = await svc.listReports(req.query);
    return success(res, result, 'Reports');
  } catch (err) {
    next(err);
  }
};

const stats = async (req, res, next) => {
  try {
    const result = await svc.stats();
    return success(res, result, 'Report stats');
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const report = await svc.updateReport(req.admin._id, req.params.reportId, req.body);
    return success(res, { report }, 'Report updated');
  } catch (err) {
    next(err);
  }
};

module.exports = { create, list, stats, update };
