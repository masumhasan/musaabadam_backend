const nodemailer = require('nodemailer');
const logger = require('./logger');

let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL,
        pass: process.env.APP_PASSWORD,
      },
    });
  }
  return transporter;
};

const sendMail = async ({ to, subject, html }) => {
  const mail = getTransporter();
  await mail.sendMail({
    from: `"BidsRush" <${process.env.EMAIL}>`,
    to,
    subject,
    html,
  });
  logger.info('Email sent', { to, subject });
};

const sendVerificationEmail = async (to, verificationToken) => {
  const link = `${process.env.APP_URL || 'http://localhost:3000'}/api/v1/auth/verify-email?token=${verificationToken}`;
  await sendMail({
    to,
    subject: 'Verify your BidsRush account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Welcome to BidsRush!</h2>
        <p>Please verify your email address to get started.</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#008BB2;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Verify Email</a>
        <p style="margin-top:16px;color:#888;font-size:13px">This link expires in 24 hours. If you did not create an account, you can ignore this email.</p>
      </div>
    `,
  });
};

const sendPasswordResetOtpEmail = async (to, otp) => {
  await sendMail({
    to,
    subject: 'Your BidsRush password reset code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Password Reset Code</h2>
        <p>You requested a password reset for your BidsRush account.</p>
        <p>Enter the following 6-digit code in the app to reset your password:</p>
        <div style="margin:24px 0;text-align:center">
          <span style="display:inline-block;padding:16px 32px;background:#008BB2;color:#fff;border-radius:8px;font-size:32px;font-weight:bold;letter-spacing:8px">${otp}</span>
        </div>
        <p style="color:#888;font-size:13px">This code expires in <strong>10 minutes</strong>. If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  });
};

const sendChangeEmailOtpEmail = async (to, otp) => {
  await sendMail({
    to,
    subject: 'Confirm your new BidsRush email address',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Confirm Email Change</h2>
        <p>We received a request to change the email address on your BidsRush account to this address.</p>
        <p>Enter the following 6-digit code in the app to confirm the change:</p>
        <div style="margin:24px 0;text-align:center">
          <span style="display:inline-block;padding:16px 32px;background:#008BB2;color:#fff;border-radius:8px;font-size:32px;font-weight:bold;letter-spacing:8px">${otp}</span>
        </div>
        <p style="color:#888;font-size:13px">This code expires in <strong>10 minutes</strong>. If you did not request this change, you can safely ignore this email.</p>
      </div>
    `,
  });
};

const sendChangePasswordOtpEmail = async (to, otp) => {
  await sendMail({
    to,
    subject: 'Confirm your BidsRush password change',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Password Change Confirmation</h2>
        <p>We received a request to change the password on your BidsRush account.</p>
        <p>Enter the following 6-digit code in the app to confirm the change:</p>
        <div style="margin:24px 0;text-align:center">
          <span style="display:inline-block;padding:16px 32px;background:#008BB2;color:#fff;border-radius:8px;font-size:32px;font-weight:bold;letter-spacing:8px">${otp}</span>
        </div>
        <p style="color:#888;font-size:13px">This code expires in <strong>10 minutes</strong>. If you did not request this change, please secure your account immediately.</p>
      </div>
    `,
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetOtpEmail, sendChangeEmailOtpEmail, sendChangePasswordOtpEmail };
