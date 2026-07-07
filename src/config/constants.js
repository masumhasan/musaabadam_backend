const ROLES = Object.freeze({
  BUYER: 'buyer',
  SELLER: 'seller',
  MODERATOR: 'moderator',
  COHOST: 'cohost',
  ADMIN: 'admin',
});

const ADMIN_ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  SUPPORT_AGENT: 'support_agent',
  MODERATOR: 'moderator',
  FINANCE_ADMIN: 'finance_admin',
});

const PERMISSIONS = Object.freeze({
  BUYER: [
    'view_streams',
    'chat',
    'bid',
    'buy',
    'follow_seller',
    'create_support_ticket',
  ],
  SELLER: [
    'create_stream',
    'manage_products',
    'manage_orders',
    'run_auction',
    'create_giveaway',
    'assign_moderator',
    'assign_cohost',
  ],
  MODERATOR: [
    'delete_messages',
    'mute_user',
    'kick_user',
    'view_reports',
  ],
  COHOST: [
    'manage_stream',
    'run_auction',
    'view_stats',
    'pin_products',
  ],
  ADMIN: ['*'],
});

const ADMIN_PERMISSIONS = Object.freeze({
  VIEW_USERS: 'VIEW_USERS',
  SUSPEND_USERS: 'SUSPEND_USERS',
  APPROVE_SELLERS: 'APPROVE_SELLERS',
  ISSUE_REFUNDS: 'ISSUE_REFUNDS',
  TERMINATE_STREAMS: 'TERMINATE_STREAMS',
  APPROVE_PAYOUTS: 'APPROVE_PAYOUTS',
  VIEW_ANALYTICS: 'VIEW_ANALYTICS',
  MANAGE_CATEGORIES: 'MANAGE_CATEGORIES',
  VIEW_REPORTS: 'VIEW_REPORTS',
  MANAGE_ADMINS: 'MANAGE_ADMINS',
});

const LISTING_TYPES = Object.freeze({
  AUCTION: 'auction',
  BUY_IT_NOW: 'buy_it_now',
  GIVEAWAY: 'giveaway',
});

const PRODUCT_CONDITIONS = Object.freeze({
  NEW: 'new',
  LIKE_NEW: 'like_new',
  EXCELLENT: 'excellent',
  GOOD: 'good',
  FAIR: 'fair',
});

const PRODUCT_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SOLD_OUT: 'sold_out',
  RESERVED: 'reserved',
  ENDED: 'ended',
});

const SELLER_STATUS = Object.freeze({
  NONE: 'none',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
  NEEDS_MORE_INFO: 'needs_more_information',
});

const OTP_TYPES = Object.freeze({
  EMAIL_VERIFY: 'email_verification',
  PASSWORD_RESET: 'password_reset',
  PHONE_VERIFY: 'phone_verification',
});

// Payments / escrow
const PAYMENT_STATUS = Object.freeze({
  REQUIRES_PAYMENT: 'requires_payment', // intent created, awaiting confirmation
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
});

// Where the captured funds currently sit
const ESCROW_STATUS = Object.freeze({
  NONE: 'none',
  HELD: 'held', // captured, held by the platform until fulfilment
  RELEASED: 'released', // moved to the seller's available balance
  REFUNDED: 'refunded', // returned to the buyer
});

const PAYOUT_STATUS = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  PAID: 'paid',
  FAILED: 'failed',
});

// Ledger entry types (wallet movements)
const LEDGER_TYPE = Object.freeze({
  ESCROW_HOLD: 'escrow_hold',
  ESCROW_RELEASE: 'escrow_release',
  REFUND: 'refund',
  PAYOUT: 'payout',
  TIP: 'tip',
  ADJUSTMENT: 'adjustment',
});

const PAYMENT = Object.freeze({
  PLATFORM_FEE_PERCENT: 10, // platform commission on each sale
  CURRENCY: 'gbp', // primary currency (UK-first per shipping defaults)
  MIN_PAYOUT: 10, // minimum available balance before a payout can be requested
});

// Live auction tuning
const AUCTION = Object.freeze({
  ANTI_SNIPE_WINDOW_MS: 10 * 1000, // a bid inside this window before close extends the timer
  ANTI_SNIPE_EXTENSION_MS: 10 * 1000, // how much to extend the close time by
  DEFAULT_DURATION_MS: 30 * 1000, // default live-auction length when none supplied
  MIN_INCREMENT: 1, // minimum amount a new bid must exceed the current high by
});

const JWT_EXPIRY = Object.freeze({
  ACCESS: '15m',
  REFRESH: '30d',
  EMAIL_VERIFY: '24h',
});

const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
});

module.exports = {
  ROLES,
  ADMIN_ROLES,
  PERMISSIONS,
  ADMIN_PERMISSIONS,
  SELLER_STATUS,
  LISTING_TYPES,
  PRODUCT_CONDITIONS,
  PRODUCT_STATUS,
  OTP_TYPES,
  AUCTION,
  PAYMENT_STATUS,
  ESCROW_STATUS,
  PAYOUT_STATUS,
  LEDGER_TYPE,
  PAYMENT,
  JWT_EXPIRY,
  HTTP_STATUS,
};
