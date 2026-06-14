const mongoose = require('mongoose');

const AdminLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
    action: { type: String, required: true, trim: true },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    targetModel: { type: String, trim: true },
    ipAddress: { type: String, trim: true },
    userAgent: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

AdminLogSchema.index({ adminId: 1, createdAt: -1 });
AdminLogSchema.index({ action: 1 });
AdminLogSchema.index({ targetId: 1 });

module.exports = mongoose.model('AdminLog', AdminLogSchema);
