const mongoose = require('mongoose');
const { OTP_TYPES } = require('../config/constants');

const OTP_TTL_SECONDS = 600; // 10 minutes

const OtpVerificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    type: {
      type: String,
      enum: Object.values(OTP_TYPES),
      required: true,
    },
    // Store hashed OTP — never store plain OTP in DB
    otpHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    isUsed: { type: Boolean, default: false },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + OTP_TTL_SECONDS * 1000),
    },
  },
  { timestamps: true }
);

// TTL index — MongoDB auto-deletes expired documents
OtpVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
OtpVerificationSchema.index({ userId: 1, type: 1 });

OtpVerificationSchema.methods.isExpired = function () {
  return this.expiresAt < new Date();
};

OtpVerificationSchema.methods.isExhausted = function () {
  return this.attempts >= this.maxAttempts;
};

module.exports = mongoose.model('OtpVerification', OtpVerificationSchema);
