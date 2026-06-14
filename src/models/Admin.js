const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ADMIN_ROLES, ADMIN_PERMISSIONS } = require('../config/constants');

const BCRYPT_ROUNDS = 12;

const AdminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: Object.values(ADMIN_ROLES),
      default: ADMIN_ROLES.SUPPORT_AGENT,
    },
    permissions: {
      type: [String],
      enum: Object.values(ADMIN_PERMISSIONS),
      default: [],
    },
    isActive: { type: Boolean, default: true },
    // Password reset OTP
    passwordResetOtp: { type: String, select: false },
    passwordResetOtpExpiry: { type: Date, select: false },
    // 2FA
    totpSecret: { type: String },
    isTotpEnabled: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

AdminSchema.index({ role: 1 });

AdminSchema.pre('save', async function () {
  if (this.isModified('passwordHash') && !this.passwordHash.startsWith('$2')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, BCRYPT_ROUNDS);
  }
});

AdminSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

AdminSchema.methods.hasPermission = function (permission) {
  if (this.role === ADMIN_ROLES.SUPER_ADMIN) return true;
  return this.permissions.includes(permission);
};

module.exports = mongoose.model('Admin', AdminSchema);
