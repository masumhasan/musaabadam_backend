const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/auth.controller');
const validate = require('../../../middleware/validate');
const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  verifyResetOtpValidator,
  resetPasswordValidator,
  refreshTokenValidator,
  resendVerificationValidator,
  verifyEmailQueryValidator,
} = require('../validators/auth.validators');

const router = express.Router();

// Strict rate limits for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts, try again later' },
});

const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { success: false, message: 'Too many email requests, try again in an hour' },
});

router.post('/register', authLimiter, registerValidator, validate, controller.register);
router.get('/verify-email', verifyEmailQueryValidator, validate, controller.verifyEmail);
router.post('/resend-verification', emailLimiter, resendVerificationValidator, validate, controller.resendVerification);
router.post('/login', authLimiter, loginValidator, validate, controller.login);
router.post('/refresh-token', refreshTokenValidator, validate, controller.refreshToken);
router.post('/logout', controller.logout);
router.post('/forgot-password', emailLimiter, forgotPasswordValidator, validate, controller.forgotPassword);
router.post('/verify-reset-otp', authLimiter, verifyResetOtpValidator, validate, controller.verifyResetOtp);
router.post('/reset-password', resetPasswordValidator, validate, controller.resetPassword);

module.exports = router;
