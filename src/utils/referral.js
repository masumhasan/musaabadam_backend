const crypto = require('crypto');

// Unambiguous alphabet — no 0/O/1/I/L to keep codes easy to read and type.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

// Generate a single random referral code (not guaranteed unique on its own).
const generateReferralCode = (length = CODE_LENGTH) => {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
};

// Generate a referral code that is unique within the User collection.
// Retries on the (astronomically unlikely) collision.
const generateUniqueReferralCode = async (User, { maxAttempts = 5 } = {}) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generateReferralCode();
    // eslint-disable-next-line no-await-in-loop
    const exists = await User.exists({ referralCode: code });
    if (!exists) return code;
  }
  // Fall back to a longer code to virtually guarantee uniqueness.
  return generateReferralCode(CODE_LENGTH + 4);
};

module.exports = { generateReferralCode, generateUniqueReferralCode };
