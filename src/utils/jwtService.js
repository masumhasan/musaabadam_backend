const jwt = require('jsonwebtoken');
const { JWT_EXPIRY } = require('../config/constants');

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not defined');
  return process.env.JWT_SECRET;
};

const adminSecret = () => {
  const s = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  if (!s) throw new Error('ADMIN_JWT_SECRET is not defined');
  return s;
};

const generateAccessToken = (payload) =>
  jwt.sign(payload, secret(), {
    expiresIn: process.env.JWT_ACCESS_EXPIRY || JWT_EXPIRY.ACCESS,
  });

const generateRefreshToken = (payload) =>
  jwt.sign(payload, secret(), {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || JWT_EXPIRY.REFRESH,
  });

// Short-lived tokens for email verification and password reset
const generateEmailToken = (payload) =>
  jwt.sign({ ...payload, type: 'email_verify' }, secret(), { expiresIn: '24h' });

// Short-lived token issued after OTP verification — used in the final reset step
const generateResetSessionToken = (payload) =>
  jwt.sign({ ...payload, type: 'otp_verified' }, secret(), { expiresIn: '5m' });

const verifyToken = (token) => jwt.verify(token, secret());

const generateAdminAccessToken = (payload) =>
  jwt.sign({ ...payload, aud: 'admin' }, adminSecret(), {
    expiresIn: process.env.ADMIN_JWT_EXPIRY || '8h',
  });

const verifyAdminToken = (token) =>
  jwt.verify(token, adminSecret(), { audience: 'admin' });

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateEmailToken,
  generateResetSessionToken,
  verifyToken,
  generateAdminAccessToken,
  verifyAdminToken,
};
