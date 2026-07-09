const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, PERMISSIONS, SELLER_STATUS } = require('../config/constants');

const BCRYPT_ROUNDS = 12;

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

const AddressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: 'Home' },
    type: { type: String, enum: ['shipping', 'pickup'], default: 'shipping' },
    fullName: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: 'US' },
    phone: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const SellerProfileSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(SELLER_STATUS),
      default: SELLER_STATUS.NONE,
    },
    primaryCategory: { type: String, trim: true },
    subcategory: { type: String, trim: true },
    sellerType: {
      type: String,
      enum: ['starting', 'active'],
    },
    businessAddress: AddressSchema,
    averageEarningRange: { type: String, trim: true },
    bio: { type: String, trim: true, maxlength: 500 },
    // Seller performance metrics — updated via aggregation/events
    totalSales: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    // Gated permissions granted by admin
    gatedPermissions: {
      type: [String],
      default: [],
      // e.g. 'marketplace_seller', 'sell_live', 'teen_seller', 'luxury_bags', etc.
    },
    stripeAccountId: { type: String },
    identityDocUrl: { type: String },
    businessLicenseUrl: { type: String },
    appliedAt: { type: Date },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
  },
  { _id: false }
);

const SocialLinksSchema = new mongoose.Schema(
  {
    instagram: { type: String, trim: true },
    twitter: { type: String, trim: true },
    youtube: { type: String, trim: true },
  },
  { _id: false }
);

const NotificationPreferencesSchema = new mongoose.Schema(
  {
    auctionEnding: { type: Boolean, default: true },
    newFollower: { type: Boolean, default: true },
    streamStarted: { type: Boolean, default: true },
    orderShipped: { type: Boolean, default: true },
    outbid: { type: Boolean, default: true },
    messages: { type: Boolean, default: true },
    promotions: { type: Boolean, default: false },
    pushEnabled: { type: Boolean, default: true },
    emailEnabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const AppPreferencesSchema = new mongoose.Schema(
  {
    directMessages: { type: Boolean, default: true },
    showSensitiveContent: { type: Boolean, default: false },
    enablePrivateEntry: { type: Boolean, default: false },
    contentCommunityBoost: { type: Boolean, default: true },
    showRealtimePromoteTool: { type: Boolean, default: true },
    displayRewardsClubStatus: { type: Boolean, default: true },
    yourPastShows: { type: Boolean, default: true },
    activityStatus: { type: Boolean, default: true },
    suggestAccountToOthers: { type: Boolean, default: true },
    syncContacts: { type: Boolean, default: false },
    country: { type: String, default: 'USA' },
  },
  { _id: false }
);

// ─── Main User Schema ─────────────────────────────────────────────────────────

const UserSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    phone: {
      type: String,
      trim: true,
      sparse: true, // allows null/undefined without unique collision
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: [/^[a-zA-Z0-9_.-]+$/, 'Username may only contain letters, numbers, underscores, hyphens, and dots'],
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    avatarUrl: { type: String, trim: true },
    coverImageUrl: { type: String, trim: true },

    // ── Credentials ───────────────────────────────────────────────────────────
    passwordHash: { type: String },
    // OAuth providers
    googleId: { type: String, sparse: true },
    appleId: { type: String, sparse: true },

    // ── Role & Permissions ───────────────────────────────────────────────────
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.BUYER,
    },
    permissions: {
      type: [String],
      default: function () {
        return [...PERMISSIONS.BUYER];
      },
    },

    // ── Account Status ────────────────────────────────────────────────────────
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, trim: true },
    bannedAt: { type: Date },
    bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    strikeCount: { type: Number, default: 0 },
    suspendedUntil: { type: Date },

    // ── Profile ───────────────────────────────────────────────────────────────
    bio: { type: String, trim: true, maxlength: 300 },
    location: { type: String, trim: true },
    socialLinks: { type: SocialLinksSchema, default: () => ({}) },

    // ── Social Stats (denormalized for performance) ───────────────────────────
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    // Buyer rating — computed from seller reviews of buyers
    buyerRating: { type: Number, default: 0, min: 0, max: 5 },
    buyerRatingCount: { type: Number, default: 0 },

    // ── Seller Profile (only populated when role is seller) ───────────────────
    sellerProfile: { type: SellerProfileSchema, default: null },

    // ── Addresses ────────────────────────────────────────────────────────────
    addresses: { type: [AddressSchema], default: [] },

    // ── Notification & App Preferences ────────────────────────────────────────
    notificationPreferences: {
      type: NotificationPreferencesSchema,
      default: () => ({}),
    },
    appPreferences: {
      type: AppPreferencesSchema,
      default: () => ({}),
    },

    // ── Device Tokens (push notifications) ───────────────────────────────────
    fcmTokens: { type: [String], default: [] },

    // ── Wallet (denormalized balance — source of truth in Wallet collection) ──
    walletBalance: { type: Number, default: 0 },
    stripeCustomerId: { type: String },
    stripeConnectAccountId: { type: String },

    // ── Rewards & Referrals ───────────────────────────────────────────────────
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rewardPoints: { type: Number, default: 0 },

    // ── Privacy / Safety ──────────────────────────────────────────────────────
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    mutedWords: { type: [String], default: [] },
    isPrivate: { type: Boolean, default: false },

    // ── Tax ───────────────────────────────────────────────────────────────────
    salesTaxExempt: { type: Boolean, default: false },
    taxExemptionDocUrl: { type: String },

    // ── Email Verification OTP ────────────────────────────────────────────────
    emailVerifyOtp: { type: String, select: false },
    emailVerifyOtpExpiry: { type: Date, select: false },

    // ── Password Reset OTP ────────────────────────────────────────────────────
    passwordResetOtp: { type: String, select: false },
    passwordResetOtpExpiry: { type: Date, select: false },

    // ── Change Email OTP (while logged in) ───────────────────────────────────
    emailChangePending: { type: String, select: false },
    emailChangeOtp: { type: String, select: false },
    emailChangeOtpExpiry: { type: Date, select: false },

    // ── Change Password OTP (while logged in) ────────────────────────────────
    passwordChangeOtp: { type: String, select: false },
    passwordChangeOtpExpiry: { type: Date, select: false },

    // ── Timestamps ────────────────────────────────────────────────────────────
    lastLoginAt: { type: Date },
    lastActiveAt: { type: Date },
    deletedAt: { type: Date, default: null }, // soft delete
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

UserSchema.index({ role: 1 });
UserSchema.index({ 'sellerProfile.status': 1 });
UserSchema.index({ isBanned: 1, isActive: 1 });
UserSchema.index({ deletedAt: 1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────

UserSchema.virtual('isSuspended').get(function () {
  return this.suspendedUntil && this.suspendedUntil > new Date();
});

UserSchema.virtual('isSellerApproved').get(function () {
  return this.sellerProfile?.status === SELLER_STATUS.APPROVED;
});

// ─── Pre-save Hooks ───────────────────────────────────────────────────────────

UserSchema.pre('save', async function () {
  if (this.isModified('passwordHash') && this.passwordHash && !this.passwordHash.startsWith('$2')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, BCRYPT_ROUNDS);
  }

  if (this.isModified('role')) {
    const roleKey = this.role.toUpperCase();
    if (this.role !== ROLES.ADMIN) {
      this.permissions = PERMISSIONS[roleKey] ? [...PERMISSIONS[roleKey]] : [...PERMISSIONS.BUYER];
    } else {
      this.permissions = ['*'];
    }
  }
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

UserSchema.methods.comparePassword = async function (plainPassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plainPassword, this.passwordHash);
};

UserSchema.methods.hasPermission = function (permission) {
  if (this.permissions.includes('*')) return true;
  return this.permissions.includes(permission);
};

UserSchema.methods.isAccountAccessible = function () {
  if (!this.isActive || this.isBanned || this.deletedAt) return false;
  if (this.suspendedUntil && this.suspendedUntil > new Date()) return false;
  return true;
};

UserSchema.methods.getAccountHealth = function () {
  if (this.isBanned) return 'Action Required';
  if (this.strikeCount >= 3) return 'Action Required';

  const status = this.sellerProfile?.status;
  const identityDoc = this.sellerProfile?.identityDocUrl;
  const licenseDoc = this.sellerProfile?.businessLicenseUrl;

  if (status === 'approved') {
    if (this.strikeCount > 0) return 'Good';
    return 'Excellent';
  }

  if (identityDoc || licenseDoc) {
    if (status === 'rejected') return 'Action Required';
    return 'Average'; // Under review / pending
  }

  return 'Action Required'; // Needs to upload KYC
};

UserSchema.methods.toPublicProfile = function () {
  return {
    id: this._id,
    username: this.username,
    displayName: this.displayName,
    avatarUrl: this.avatarUrl,
    coverImageUrl: this.coverImageUrl,
    bio: this.bio,
    location: this.location,
    role: this.role,
    followersCount: this.followersCount,
    followingCount: this.followingCount,
    buyerRating: this.buyerRating,
    isSellerApproved: this.isSellerApproved,
    sellerProfile: this.role === ROLES.SELLER
      ? {
          primaryCategory: this.sellerProfile?.primaryCategory,
          bio: this.sellerProfile?.bio,
          averageRating: this.sellerProfile?.averageRating,
          ratingCount: this.sellerProfile?.ratingCount,
          totalSales: this.sellerProfile?.totalSales,
        }
      : undefined,
    socialLinks: this.socialLinks,
    createdAt: this.createdAt,
  };
};

UserSchema.methods.toPrivateProfile = function () {
  return {
    id: this._id,
    email: this.email,
    phone: this.phone,
    username: this.username,
    displayName: this.displayName,
    avatarUrl: this.avatarUrl,
    coverImageUrl: this.coverImageUrl,
    bio: this.bio,
    location: this.location,
    role: this.role,
    permissions: this.permissions,
    isEmailVerified: this.isEmailVerified,
    isPhoneVerified: this.isPhoneVerified,
    followersCount: this.followersCount,
    followingCount: this.followingCount,
    buyerRating: this.buyerRating,
    sellerProfile: this.sellerProfile,
    accountHealth: this.getAccountHealth(),
    addresses: this.addresses,
    notificationPreferences: this.notificationPreferences,
    walletBalance: this.walletBalance,
    rewardPoints: this.rewardPoints,
    referralCode: this.referralCode,
    salesTaxExempt: this.salesTaxExempt,
    isSellerApproved: this.isSellerApproved,
    isSuspended: this.isSuspended,
    createdAt: this.createdAt,
    lastLoginAt: this.lastLoginAt,
  };
};

// ─── Static Methods ───────────────────────────────────────────────────────────

UserSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase().trim(), deletedAt: null });
};

UserSchema.statics.findByUsername = function (username) {
  return this.findOne({ username: username.trim(), deletedAt: null });
};

UserSchema.statics.existsByEmail = async function (email) {
  const count = await this.countDocuments({ email: email.toLowerCase().trim(), deletedAt: null });
  return count > 0;
};

UserSchema.statics.existsByUsername = async function (username) {
  const count = await this.countDocuments({ username: username.trim(), deletedAt: null });
  return count > 0;
};

module.exports = mongoose.model('User', UserSchema);
