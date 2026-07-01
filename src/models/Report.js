const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const REPORT_TARGET = Object.freeze({
  USER: 'user',
  SELLER: 'seller',
  STREAM: 'stream',
  PRODUCT: 'product',
  MESSAGE: 'message',
});

const REPORT_STATUS = Object.freeze({
  OPEN: 'open',
  REVIEWING: 'reviewing',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
});

const REPORT_REASON = Object.freeze({
  SPAM: 'spam',
  HARASSMENT: 'harassment',
  INAPPROPRIATE: 'inappropriate',
  SCAM: 'scam',
  COUNTERFEIT: 'counterfeit',
  OTHER: 'other',
});

const ReportSchema = new mongoose.Schema(
  {
    reporterId: { type: ObjectId, ref: 'User', required: true },

    targetType: { type: String, enum: Object.values(REPORT_TARGET), required: true },
    targetId: { type: ObjectId, required: true }, // id of the reported entity

    reason: { type: String, enum: Object.values(REPORT_REASON), required: true },
    details: { type: String, trim: true, maxlength: 1000 },

    status: { type: String, enum: Object.values(REPORT_STATUS), default: REPORT_STATUS.OPEN },

    // Admin moderation.
    resolvedBy: { type: ObjectId, ref: 'Admin' },
    resolutionNote: { type: String, trim: true },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

ReportSchema.index({ status: 1, createdAt: -1 });
ReportSchema.index({ targetType: 1, targetId: 1 });
// One open report per reporter+target (prevents spam-reporting).
ReportSchema.index({ reporterId: 1, targetType: 1, targetId: 1 }, { unique: true });

module.exports = mongoose.model('Report', ReportSchema);
module.exports.REPORT_TARGET = REPORT_TARGET;
module.exports.REPORT_STATUS = REPORT_STATUS;
module.exports.REPORT_REASON = REPORT_REASON;
