const Report = require('../../../models/Report');
const { REPORT_STATUS } = require('../../../models/Report');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS } = require('../../../config/constants');

// A user files a report against another entity.
const createReport = async (reporterId, { targetType, targetId, reason, details }) => {
  try {
    const report = await Report.create({ reporterId, targetType, targetId, reason, details });
    return report;
  } catch (err) {
    if (err.code === 11000) throw new AppError('You already reported this', HTTP_STATUS.CONFLICT);
    throw err;
  }
};

// Admin: list reports (optionally by status), newest first.
const listReports = async ({ status, page = 1, limit = 20 } = {}) => {
  const query = {};
  if (status) query.status = status;
  const skip = (Number(page) - 1) * Number(limit);
  const [reports, total] = await Promise.all([
    Report.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('reporterId', 'username displayName'),
    Report.countDocuments(query),
  ]);
  return { reports, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
};

// Admin: change a report's status / resolve it.
const updateReport = async (adminId, reportId, { status, resolutionNote }) => {
  const report = await Report.findById(reportId);
  if (!report) throw new AppError('Report not found', HTTP_STATUS.NOT_FOUND);
  report.status = status;
  if (resolutionNote !== undefined) report.resolutionNote = resolutionNote;
  if ([REPORT_STATUS.RESOLVED, REPORT_STATUS.DISMISSED].includes(status)) {
    report.resolvedBy = adminId;
    report.resolvedAt = new Date();
  }
  await report.save();
  return report;
};

const stats = async () => {
  const [open, reviewing, resolved, dismissed] = await Promise.all([
    Report.countDocuments({ status: REPORT_STATUS.OPEN }),
    Report.countDocuments({ status: REPORT_STATUS.REVIEWING }),
    Report.countDocuments({ status: REPORT_STATUS.RESOLVED }),
    Report.countDocuments({ status: REPORT_STATUS.DISMISSED }),
  ]);
  return { open, reviewing, resolved, dismissed };
};

module.exports = { createReport, listReports, updateReport, stats };
