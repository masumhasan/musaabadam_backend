const logger = require('./logger');

// ─── Social sign-in token verification ────────────────────────────────────────
// Verifies Google / Apple ID tokens. When the verification libraries + client
// ids are configured, tokens are cryptographically verified. Otherwise a DEV
// fallback decodes the JWT payload WITHOUT signature checking (insecure — for
// local development only), so the social-login flow works end-to-end.

// Base64url-decode a JWT payload (no signature verification).
const decodeJwtPayload = (token) => {
  const parts = String(token).split('.');
  if (parts.length < 2) throw new Error('Malformed token');
  const json = Buffer.from(parts[1], 'base64').toString('utf8');
  return JSON.parse(json);
};

let verifyGoogle;
if (process.env.GOOGLE_CLIENT_ID) {
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    verifyGoogle = async (idToken) => {
      const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
      const p = ticket.getPayload();
      return { providerId: p.sub, email: p.email, name: p.name, avatar: p.picture, emailVerified: p.email_verified };
    };
    logger.info('Social auth: Google (verified)');
  } catch (err) {
    logger.warn(`Google auth configured but library unavailable (${err.message}); using dev decode`);
  }
}
if (!verifyGoogle) {
  verifyGoogle = async (idToken) => {
    const p = decodeJwtPayload(idToken);
    return { providerId: p.sub, email: p.email, name: p.name, avatar: p.picture, emailVerified: p.email_verified };
  };
}

// Apple: full verification requires fetching Apple's JWKS. For now we decode the
// identity token (dev) — swap in `apple-signin-auth` when going live.
const verifyApple = async (idToken) => {
  const p = decodeJwtPayload(idToken);
  return { providerId: p.sub, email: p.email, name: p.name || null, avatar: null, emailVerified: p.email_verified };
};

const verifyToken = async (provider, idToken) => {
  if (provider === 'google') return verifyGoogle(idToken);
  if (provider === 'apple') return verifyApple(idToken);
  throw new Error('Unsupported provider');
};

module.exports = { verifyToken };
