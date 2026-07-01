const authService = require('../services/auth.service');
const { success, created, error } = require('../../../utils/apiResponse');
const { HTTP_STATUS } = require('../../../config/constants');
const logger = require('../../../utils/logger');

const register = async (req, res, next) => {
  try {
    const { email, password, username, referralCode } = req.body;
    const result = await authService.register({
      email,
      password,
      username,
      referralCode,
      ipAddress: req.ip,
    });
    return created(res, result, 'Account created. Please check your email to verify your account.');
  } catch (err) {
    next(err);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const result = await authService.verifyEmail(email, otp, {
      ipAddress: req.ip,
      deviceInfo: req.headers['user-agent'],
    });
    return success(res, result, 'Email verified successfully');
  } catch (err) {
    next(err);
  }
};

const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.resendVerification(email);
    return success(res, null, result.message);
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({
      email,
      password,
      ipAddress: req.ip,
      deviceInfo: req.headers['user-agent'],
    });
    return success(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    const result = await authService.refreshAccessToken(token, req.ip);
    return success(res, result, 'Token refreshed');
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    await authService.logout(token);
    return success(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    return success(res, null, result.message);
  } catch (err) {
    next(err);
  }
};

const verifyResetOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const result = await authService.verifyResetOtp(email, otp);
    return success(res, result, 'Code verified');
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body;
    const result = await authService.resetPassword(resetToken, newPassword);
    return success(res, null, result.message);
  } catch (err) {
    next(err);
  }
};

const initiateEmailChange = async (req, res, next) => {
  try {
    const result = await authService.initiateEmailChange(req.user._id, req.body.newEmail);
    return success(res, null, result.message);
  } catch (err) {
    next(err);
  }
};

const verifyEmailChange = async (req, res, next) => {
  try {
    const user = await authService.verifyEmailChange(req.user._id, req.body.otp);
    return success(res, { user }, 'Email updated successfully');
  } catch (err) {
    next(err);
  }
};

const initiatePasswordChange = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.initiatePasswordChange(req.user._id, currentPassword, newPassword);
    return success(res, null, result.message);
  } catch (err) {
    next(err);
  }
};

const verifyPasswordChange = async (req, res, next) => {
  try {
    const { otp, newPassword } = req.body;
    const result = await authService.verifyPasswordChange(req.user._id, otp, newPassword);
    return success(res, null, result.message);
  } catch (err) {
    next(err);
  }
};

module.exports = { register, verifyEmail, resendVerification, login, refreshToken, logout, forgotPassword, verifyResetOtp, resetPassword, initiateEmailChange, verifyEmailChange, initiatePasswordChange, verifyPasswordChange };
