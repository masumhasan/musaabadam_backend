const adminAuthService = require('../services/admin.auth.service');
const { success } = require('../../../utils/apiResponse');

const login = async (req, res, next) => {
  try {
    const result = await adminAuthService.login({
      email: req.body.email,
      password: req.body.password,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return success(res, result, 'Login successful');
  } catch (err) { next(err); }
};

const me = (req, res) => {
  const { _id, email, firstName, lastName, role, permissions, isTotpEnabled, lastLoginAt } = req.admin;
  return success(res, { id: _id, email, firstName, lastName, role, permissions, isTotpEnabled, lastLoginAt });
};

const forgotPassword = async (req, res, next) => {
  try {
    const result = await adminAuthService.forgotPassword(req.body.email);
    return success(res, null, result.message);
  } catch (err) { next(err); }
};

const verifyResetOtp = async (req, res, next) => {
  try {
    const result = await adminAuthService.verifyResetOtp(req.body.email, req.body.otp);
    return success(res, result, 'Code verified');
  } catch (err) { next(err); }
};

const resetPassword = async (req, res, next) => {
  try {
    const result = await adminAuthService.resetPassword(req.body.resetToken, req.body.newPassword);
    return success(res, null, result.message);
  } catch (err) { next(err); }
};

module.exports = { login, me, forgotPassword, verifyResetOtp, resetPassword };
