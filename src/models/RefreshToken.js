const mongoose = require('mongoose');

const REFRESH_TTL_DAYS = 7;

const RefreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tokenHash: { type: String, required: true },
    deviceInfo: { type: String, trim: true },
    ipAddress: { type: String, trim: true },
    isRevoked: { type: Boolean, default: false },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

// Auto-delete expired tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
RefreshTokenSchema.index({ userId: 1 });
RefreshTokenSchema.index({ tokenHash: 1 });

RefreshTokenSchema.methods.isExpired = function () {
  return this.expiresAt < new Date();
};

RefreshTokenSchema.methods.isValid = function () {
  return !this.isRevoked && !this.isExpired();
};

module.exports = mongoose.model('RefreshToken', RefreshTokenSchema);
