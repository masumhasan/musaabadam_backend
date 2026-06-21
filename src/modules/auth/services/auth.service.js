const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../../../models/User');
const RefreshToken = require('../../../models/RefreshToken');
const { generateAccessToken, generateRefreshToken, generateResetSessionToken } = require('../../../utils/jwtService');
const { sendVerificationOtpEmail, sendPasswordResetOtpEmail, sendChangeEmailOtpEmail, sendChangePasswordOtpEmail } = require('../../../utils/emailService');
const { ROLES, PERMISSIONS } = require('../../../config/constants');
const { AppError } = require('../../../middleware/errorHandler');
const { HTTP_STATUS } = require('../../../config/constants');

const BCRYPT_ROUNDS = 12;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const generateUsername = (email) => {
  const base = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}_${suffix}`;
};

const buildTokenPair = (user) => ({
  accessToken: generateAccessToken({ sub: user._id.toString(), role: user.role }),
  refreshToken: generateRefreshToken({ sub: user._id.toString() }),
});

const saveRefreshToken = async (userId, rawToken, ipAddress, deviceInfo) => {
  const tokenHash = hashToken(rawToken);
  await RefreshToken.create({ userId, tokenHash, ipAddress, deviceInfo });
};

// ─── Service Methods ──────────────────────────────────────────────────────────

const register = async ({ email, password, username, ipAddress }) => {
  const normalizedEmail = email.toLowerCase().trim();

  if (await User.existsByEmail(normalizedEmail)) {
    throw new AppError('An account with this email already exists', HTTP_STATUS.CONFLICT);
  }

  const finalUsername = username
    ? username.trim()
    : generateUsername(normalizedEmail);

  if (await User.existsByUsername(finalUsername)) {
    throw new AppError('Username is already taken', HTTP_STATUS.CONFLICT);
  }

  const user = await User.create({
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    username: finalUsername,
    displayName: finalUsername,
    role: ROLES.BUYER,
    permissions: [...PERMISSIONS.BUYER],
  });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.emailVerifyOtp = hashToken(otp);
  user.emailVerifyOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await user.save();

  await sendVerificationOtpEmail(normalizedEmail, otp);

  return { userId: user._id, email: normalizedEmail };
};

const verifyEmail = async (email, otp, { ipAddress, deviceInfo } = {}) => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findByEmail(normalizedEmail).select('+emailVerifyOtp +emailVerifyOtpExpiry');
  if (!user) throw new AppError('No account found with this email', HTTP_STATUS.NOT_FOUND);
  if (user.isEmailVerified) throw new AppError('Email is already verified. Please log in.', HTTP_STATUS.CONFLICT);

  const invalid = !user.emailVerifyOtp || !user.emailVerifyOtpExpiry;
  if (invalid) throw new AppError('No verification code found. Please request a new one.', HTTP_STATUS.BAD_REQUEST);

  if (user.emailVerifyOtpExpiry < new Date()) {
    throw new AppError('Code has expired. Please request a new one.', HTTP_STATUS.BAD_REQUEST);
  }

  if (hashToken(otp) !== user.emailVerifyOtp) {
    throw new AppError('Incorrect code. Please try again.', HTTP_STATUS.BAD_REQUEST);
  }

  user.isEmailVerified = true;
  user.emailVerifyOtp = undefined;
  user.emailVerifyOtpExpiry = undefined;
  user.lastLoginAt = new Date();
  await user.save();

  // Issue tokens so the user is authenticated immediately after verification
  const { accessToken, refreshToken } = buildTokenPair(user);
  await saveRefreshToken(user._id, refreshToken, ipAddress, deviceInfo);

  return { accessToken, refreshToken, user: user.toPrivateProfile() };
};

const resendVerification = async (email) => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findByEmail(normalizedEmail).select('+emailVerifyOtp +emailVerifyOtpExpiry');
  if (!user) throw new AppError('No account found with this email', HTTP_STATUS.NOT_FOUND);
  if (user.isEmailVerified) throw new AppError('Email is already verified', HTTP_STATUS.CONFLICT);

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.emailVerifyOtp = hashToken(otp);
  user.emailVerifyOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  await sendVerificationOtpEmail(normalizedEmail, otp);

  return { message: 'Verification code sent' };
};

const login = async ({ email, password, ipAddress, deviceInfo }) => {
  const user = await User.findByEmail(email);
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
  }

  if (!user.isActive || user.isBanned) {
    throw new AppError('Your account has been suspended. Contact support.', HTTP_STATUS.FORBIDDEN);
  }

  if (user.suspendedUntil && user.suspendedUntil > new Date()) {
    throw new AppError(
      `Account suspended until ${user.suspendedUntil.toISOString()}`,
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { accessToken, refreshToken } = buildTokenPair(user);
  await saveRefreshToken(user._id, refreshToken, ipAddress, deviceInfo);

  user.lastLoginAt = new Date();
  await user.save();

  return { accessToken, refreshToken, user: user.toPrivateProfile() };
};

const refreshAccessToken = async (rawRefreshToken, ipAddress) => {
  let decoded;
  try {
    decoded = verifyToken(rawRefreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', HTTP_STATUS.UNAUTHORIZED);
  }

  const tokenHash = hashToken(rawRefreshToken);
  const stored = await RefreshToken.findOne({ tokenHash, isRevoked: false });
  if (!stored || !stored.isValid()) {
    throw new AppError('Refresh token revoked or expired', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await User.findById(decoded.sub);
  if (!user || !user.isAccountAccessible()) {
    throw new AppError('Account not accessible', HTTP_STATUS.UNAUTHORIZED);
  }

  // Rotate: revoke old, issue new pair
  stored.isRevoked = true;
  await stored.save();

  const { accessToken, refreshToken: newRefreshToken } = buildTokenPair(user);
  await saveRefreshToken(user._id, newRefreshToken, ipAddress, stored.deviceInfo);

  return { accessToken, refreshToken: newRefreshToken };
};

const logout = async (rawRefreshToken) => {
  if (!rawRefreshToken) return;
  const tokenHash = hashToken(rawRefreshToken);
  await RefreshToken.updateOne({ tokenHash }, { isRevoked: true });
};

const forgotPassword = async (email) => {
  const user = await User.findByEmail(email).select('+passwordResetOtp +passwordResetOtpExpiry');
  // Always return success — do not reveal whether the email is registered
  if (!user) return { message: 'If this email is registered, you will receive a 6-digit code' };

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = hashToken(otp);

  user.passwordResetOtp = otpHash;
  user.passwordResetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await user.save();

  await sendPasswordResetOtpEmail(user.email, otp);

  return { message: 'If this email is registered, you will receive a 6-digit code' };
};

const verifyResetOtp = async (email, otp) => {
  const user = await User.findByEmail(email).select('+passwordResetOtp +passwordResetOtpExpiry');

  const invalid = !user || !user.passwordResetOtp || !user.passwordResetOtpExpiry;
  if (invalid) throw new AppError('Invalid or expired code', HTTP_STATUS.BAD_REQUEST);

  if (user.passwordResetOtpExpiry < new Date()) {
    throw new AppError('Code has expired. Please request a new one.', HTTP_STATUS.BAD_REQUEST);
  }

  const otpHash = hashToken(otp);
  if (otpHash !== user.passwordResetOtp) {
    throw new AppError('Incorrect code. Please try again.', HTTP_STATUS.BAD_REQUEST);
  }

  // OTP is valid — clear it immediately to prevent reuse
  user.passwordResetOtp = undefined;
  user.passwordResetOtpExpiry = undefined;
  await user.save();

  // Issue a short-lived reset session token (5 min) for the next step
  const resetToken = generateResetSessionToken({ sub: user._id.toString(), email: user.email });
  return { resetToken };
};

const resetPassword = async (resetToken, newPassword) => {
  let decoded;
  try {
    decoded = verifyToken(resetToken);
  } catch {
    throw new AppError('Session expired. Please start over.', HTTP_STATUS.BAD_REQUEST);
  }

  if (decoded.type !== 'otp_verified') {
    throw new AppError('Invalid reset session', HTTP_STATUS.BAD_REQUEST);
  }

  const user = await User.findById(decoded.sub);
  if (!user || user.email !== decoded.email) {
    throw new AppError('Invalid reset session', HTTP_STATUS.BAD_REQUEST);
  }

  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.save();

  // Revoke all existing sessions after password change
  await RefreshToken.updateMany({ userId: user._id }, { isRevoked: true });

  return { message: 'Password reset successfully' };
};

// ─── Change Email (authenticated) ────────────────────────────────────────────

const initiateEmailChange = async (userId, newEmail) => {
  const normalized = newEmail.toLowerCase().trim();

  if (await User.existsByEmail(normalized)) {
    throw new AppError('This email is already in use', HTTP_STATUS.CONFLICT);
  }

  const user = await User.findById(userId).select('+emailChangeOtp +emailChangeOtpExpiry +emailChangePending');
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.emailChangePending = normalized;
  user.emailChangeOtp = hashToken(otp);
  user.emailChangeOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  await sendChangeEmailOtpEmail(normalized, otp);
  return { message: 'A verification code was sent to your new email address' };
};

const verifyEmailChange = async (userId, otp) => {
  const user = await User.findById(userId).select('+emailChangeOtp +emailChangeOtpExpiry +emailChangePending');
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);

  const invalid = !user.emailChangeOtp || !user.emailChangeOtpExpiry || !user.emailChangePending;
  if (invalid) throw new AppError('No pending email change. Please start over.', HTTP_STATUS.BAD_REQUEST);

  if (user.emailChangeOtpExpiry < new Date()) {
    throw new AppError('Code has expired. Please request a new one.', HTTP_STATUS.BAD_REQUEST);
  }

  if (hashToken(otp) !== user.emailChangeOtp) {
    throw new AppError('Incorrect code. Please try again.', HTTP_STATUS.BAD_REQUEST);
  }

  user.email = user.emailChangePending;
  user.isEmailVerified = true;
  user.emailChangePending = undefined;
  user.emailChangeOtp = undefined;
  user.emailChangeOtpExpiry = undefined;
  await user.save();

  return user.toPrivateProfile();
};

// ─── Change Password (authenticated) ─────────────────────────────────────────

const initiatePasswordChange = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select('+passwordHash +passwordChangeOtp +passwordChangeOtpExpiry');
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);

  const valid = await user.comparePassword(currentPassword);
  if (!valid) throw new AppError('Current password is incorrect', HTTP_STATUS.UNAUTHORIZED);

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.passwordChangeOtp = hashToken(otp);
  user.passwordChangeOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  await sendChangePasswordOtpEmail(user.email, otp);
  return { message: 'A verification code was sent to your email address' };
};

const verifyPasswordChange = async (userId, otp, newPassword) => {
  const user = await User.findById(userId).select('+passwordChangeOtp +passwordChangeOtpExpiry');
  if (!user) throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);

  const invalid = !user.passwordChangeOtp || !user.passwordChangeOtpExpiry;
  if (invalid) throw new AppError('No pending password change. Please start over.', HTTP_STATUS.BAD_REQUEST);

  if (user.passwordChangeOtpExpiry < new Date()) {
    throw new AppError('Code has expired. Please request a new one.', HTTP_STATUS.BAD_REQUEST);
  }

  if (hashToken(otp) !== user.passwordChangeOtp) {
    throw new AppError('Incorrect code. Please try again.', HTTP_STATUS.BAD_REQUEST);
  }

  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  user.passwordChangeOtp = undefined;
  user.passwordChangeOtpExpiry = undefined;
  await user.save();

  return { message: 'Password changed successfully' };
};

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  refreshAccessToken,
  logout,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  initiateEmailChange,
  verifyEmailChange,
  initiatePasswordChange,
  verifyPasswordChange,
};
