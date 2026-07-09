const mongoose = require('mongoose');
const { LISTING_TYPES, PRODUCT_CONDITIONS, PRODUCT_STATUS } = require('../config/constants');

const VariantSchema = new mongoose.Schema(
  {
    size: { type: String, trim: true },
    color: { type: String, trim: true },
    sku: { type: String, trim: true },
    quantity: { type: Number, default: 1, min: 0 },
    priceOverride: { type: Number, min: 0 },
  },
  { _id: true }
);

const ProductSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Core
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    category: { type: String, required: true, trim: true },
    condition: { type: String, enum: Object.values(PRODUCT_CONDITIONS), required: true },
    listingType: { type: String, enum: Object.values(LISTING_TYPES), required: true },
    status: { type: String, enum: Object.values(PRODUCT_STATUS), default: PRODUCT_STATUS.DRAFT },

    // Pricing — buy_it_now / giveaway
    price: { type: Number, min: 0, default: 0 },

    // Pricing — auction
    startingPrice: { type: Number, min: 0 },
    reservePrice: { type: Number, min: 0 },
    currentHighBid: { type: Number, min: 0, default: 0 },
    highestBidderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    auctionEndsAt: { type: Date },
    // Live-auction runtime control
    auctionState: { type: String, enum: ['none', 'running', 'paused'], default: 'none' },
    bidIncrement: { type: Number, min: 0.01, default: 1 },
    auctionPausedRemainingMs: { type: Number, min: 0 },

    // Inventory
    quantity: { type: Number, required: true, min: 1, default: 1 },
    quantitySold: { type: Number, default: 0, min: 0 },

    // Media (stored URLs — S3 integration deferred)
    images: { type: [String], default: [] },

    // Seller-private tracking
    sku: { type: String, trim: true },
    costPerItem: { type: Number, min: 0 },

    // Listing features
    flashSale: { type: Boolean, default: false },
    flashSalePrice: { type: Number, min: 0 }, // discounted price while active
    flashSaleEndsAt: { type: Date }, // auto-expires at this time
    flashSaleStock: { type: Number, min: 0 }, // optional units cap for the sale
    flashSaleSold: { type: Number, min: 0, default: 0 },
    acceptOffers: { type: Boolean, default: false },
    maxDiscount: { type: Number, min: 0, max: 100, default: 0 },
    reserveForLive: { type: Boolean, default: false },

    // Shipping
    shippingProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShippingProfile' },
    shippingWeight: { type: Number, min: 0 },
    hazardousMaterials: { type: Boolean, default: false },

    // Variants (size / color options)
    variants: { type: [VariantSchema], default: [] },

    // Live stream association (set when seller pins product to a stream)
    streamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stream' },

    // Social stats
    viewsCount: { type: Number, default: 0 },
    favoritesCount: { type: Number, default: 0 },

    tags: { type: [String], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

ProductSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
ProductSchema.index({ status: 1, listingType: 1, category: 1 });
ProductSchema.index({ status: 1, auctionEndsAt: 1 });
ProductSchema.index({ deletedAt: 1 });
ProductSchema.index({ title: 'text', description: 'text', tags: 'text' });

// ─── Virtuals ─────────────────────────────────────────────────────────────────

ProductSchema.virtual('isAvailable').get(function () {
  return this.status === PRODUCT_STATUS.ACTIVE && this.quantity > this.quantitySold;
});

ProductSchema.virtual('isAuctionLive').get(function () {
  return (
    this.listingType === LISTING_TYPES.AUCTION &&
    this.status === PRODUCT_STATUS.ACTIVE &&
    this.auctionEndsAt &&
    this.auctionEndsAt > new Date()
  );
});

ProductSchema.virtual('isFlashSaleActive').get(function () {
  return (
    this.flashSale &&
    this.flashSalePrice != null &&
    this.flashSaleEndsAt &&
    this.flashSaleEndsAt > new Date() &&
    (this.flashSaleStock == null || (this.flashSaleSold || 0) < this.flashSaleStock)
  );
});

// The price a buyer actually pays right now (honours an active flash sale).
ProductSchema.methods.effectivePrice = function () {
  if (this.isFlashSaleActive) return this.flashSalePrice;
  return this.price;
};

// ─── Statics ──────────────────────────────────────────────────────────────────

ProductSchema.statics.findByIdAndSeller = function (productId, sellerId) {
  return this.findOne({ _id: productId, sellerId, deletedAt: null });
};

module.exports = mongoose.model('Product', ProductSchema);
