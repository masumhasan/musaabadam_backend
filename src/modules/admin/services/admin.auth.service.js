const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Admin = require('../../../models/Admin');
const AdminLog = require('../../../models/AdminLog');
const { generateAdminAccessToken, generateResetSessionToken, verifyToken } = require('../../../utils/jwtService');
const { sendPasswordResetOtpEmail } = require('../../../utils/emailService');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS } = require('../../../config/constants');

const BCRYPT_ROUNDS = 12;
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

const login = async ({ email, password, ipAddress, userAgent }) => {
  const admin = await Admin.findOne({ email: email.toLowerCase().trim() });

  if (!admin || !admin.isActive) {
    throw new AppError('Invalid credentials', HTTP_STATUS.UNAUTHORIZED);
  }

  const isValid = await admin.comparePassword(password);
  if (!isValid) {
    throw new AppError('Invalid credentials', HTTP_STATUS.UNAUTHORIZED);
  }

  admin.lastLoginAt = new Date();
  admin.lastLoginIp = ipAddress;
  await admin.save();

  await AdminLog.create({
    adminId: admin._id,
    action: 'ADMIN_LOGIN',
    ipAddress,
    userAgent,
  });

  const token = generateAdminAccessToken({
    sub: admin._id.toString(),
    role: admin.role,
  });

  return {
    token,
    admin: {
      id: admin._id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
      permissions: admin.permissions,
      isTotpEnabled: admin.isTotpEnabled,
    },
  };
};

const forgotPassword = async (email) => {
  const admin = await Admin.findOne({ email: email.toLowerCase().trim() })
    .select('+passwordResetOtp +passwordResetOtpExpiry');

  // Always return success to avoid email enumeration
  if (!admin || !admin.isActive) {
    return { message: 'If this email is registered, you will receive a 6-digit code' };
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  admin.passwordResetOtp = hashToken(otp);
  admin.passwordResetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await admin.save();

  await sendPasswordResetOtpEmail(admin.email, otp);

  return { message: 'If this email is registered, you will receive a 6-digit code' };
};

const verifyResetOtp = async (email, otp) => {
  const admin = await Admin.findOne({ email: email.toLowerCase().trim() })
    .select('+passwordResetOtp +passwordResetOtpExpiry');

  const invalid = !admin || !admin.passwordResetOtp || !admin.passwordResetOtpExpiry;
  if (invalid) throw new AppError('Invalid or expired code', HTTP_STATUS.BAD_REQUEST);

  if (admin.passwordResetOtpExpiry < new Date()) {
    throw new AppError('Code has expired. Please request a new one.', HTTP_STATUS.BAD_REQUEST);
  }

  if (hashToken(otp) !== admin.passwordResetOtp) {
    throw new AppError('Incorrect code. Please try again.', HTTP_STATUS.BAD_REQUEST);
  }

  admin.passwordResetOtp = undefined;
  admin.passwordResetOtpExpiry = undefined;
  await admin.save();

  // Issue a short-lived reset session token scoped to admin email
  const resetToken = generateResetSessionToken({ sub: admin._id.toString(), email: admin.email, aud: 'admin' });
  return { resetToken };
};

const resetPassword = async (resetToken, newPassword) => {
  let decoded;
  try {
    decoded = verifyToken(resetToken);
  } catch {
    throw new AppError('Session expired. Please start over.', HTTP_STATUS.BAD_REQUEST);
  }

  if (decoded.type !== 'otp_verified' || decoded.aud !== 'admin') {
    throw new AppError('Invalid reset session', HTTP_STATUS.BAD_REQUEST);
  }

  const admin = await Admin.findById(decoded.sub);
  if (!admin || admin.email !== decoded.email) {
    throw new AppError('Invalid reset session', HTTP_STATUS.BAD_REQUEST);
  }

  admin.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await admin.save();

  return { message: 'Password reset successfully' };
};

module.exports = { login, forgotPassword, verifyResetOtp, resetPassword };
