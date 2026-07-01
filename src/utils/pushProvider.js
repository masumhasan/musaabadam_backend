const logger = require('./logger');

// ─── Push notification provider abstraction ───────────────────────────────────
// Sends device push via Firebase Cloud Messaging when FIREBASE_SERVICE_ACCOUNT
// (JSON) is configured AND firebase-admin is installed. Otherwise a no-op logger
// is used so the notification flow works end-to-end in development (mirrors the
// payment-provider pattern).

let _send = async ({ tokens, title, body, data }) => {
  logger.info(`[push:mock] → ${(tokens || []).length} device(s): ${title} — ${body || ''}`, { data });
  return { successCount: 0, mock: true };
};

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
      });
    }
    _send = async ({ tokens, title, body, data }) => {
      if (!tokens || tokens.length === 0) return { successCount: 0 };
      const res = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)])),
      });
      return { successCount: res.successCount };
    };
    logger.info('Push provider: Firebase Cloud Messaging');
  } catch (err) {
    logger.warn(`FCM configured but unavailable (${err.message}); using mock push`);
  }
} else {
  logger.info('Push provider: mock (no FIREBASE_SERVICE_ACCOUNT set)');
}

const sendPush = (args) => _send(args).catch((err) => logger.error('Push send failed', { error: err.message }));

module.exports = { sendPush };
