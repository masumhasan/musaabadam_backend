const { body } = require('express-validator');

const registerValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail({ gmail_remove_dots: false }),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be 3–30 characters')
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage('Username may only contain letters, numbers, underscores, hyphens, and dots'),
  body('referralCode')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 4, max: 16 })
    .withMessage('Referral code must be 4–16 characters')
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage('Referral code may only contain letters and numbers'),
];

const loginValidator = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail({ gmail_remove_dots: false }),
  body('password').notEmpty().withMessage('Password is required'),
];

const forgotPasswordValidator = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail({ gmail_remove_dots: false }),
];

const verifyResetOtpValidator = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail({ gmail_remove_dots: false }),
  body('otp')
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('OTP must be a 6-digit number'),
];

const resetPasswordValidator = [
  body('resetToken').trim().notEmpty().withMessage('Reset session token is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
];

const refreshTokenValidator = [
  body('refreshToken').trim().notEmpty().withMessage('Refresh token is required'),
];

const resendVerificationValidator = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail({ gmail_remove_dots: false }),
];

const verifyEmailOtpValidator = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail({ gmail_remove_dots: false }),
  body('otp').trim().matches(/^\d{6}$/).withMessage('OTP must be a 6-digit number'),
];

const otpField = body('otp')
  .trim()
  .matches(/^\d{6}$/)
  .withMessage('OTP must be a 6-digit number');

const newPasswordField = body('newPassword')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters')
  .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
  .matches(/[0-9]/).withMessage('Password must contain a number');

const initiateEmailChangeValidator = [
  body('newEmail').trim().isEmail().withMessage('Valid email is required').normalizeEmail({ gmail_remove_dots: false }),
];

const verifyEmailChangeValidator = [otpField];

const initiatePasswordChangeValidator = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  newPasswordField,
];

const verifyPasswordChangeValidator = [otpField, newPasswordField];

module.exports = {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  verifyResetOtpValidator,
  resetPasswordValidator,
  refreshTokenValidator,
  resendVerificationValidator,
  verifyEmailOtpValidator,
  initiateEmailChangeValidator,
  verifyEmailChangeValidator,
  initiatePasswordChangeValidator,
  verifyPasswordChangeValidator,
};
