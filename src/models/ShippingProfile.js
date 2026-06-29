const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const CARRIERS = Object.freeze({
  ROYAL_MAIL: 'royal_mail', // UK default
  DPD: 'dpd',
  EVRI: 'evri',
  UPS: 'ups',
});

// A weight-banded rate within a profile (price in the profile's currency).
const RateTierSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true }, // e.g. 'Standard', 'Expedited', 'Overnight'
    maxWeightKg: { type: Number, min: 0 }, // upper bound this tier applies to (null = no cap)
    price: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

// Seller shipping profile — reusable across listings.
const ShippingProfileSchema = new mongoose.Schema(
  {
    sellerId: { type: ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },

    carrier: { type: String, enum: Object.values(CARRIERS), default: CARRIERS.ROYAL_MAIL },
    currency: { type: String, default: 'gbp' },

    // Flat fee used when no weight tiers match (or weight unknown).
    flatRate: { type: Number, default: 0, min: 0 },
    freeShippingThreshold: { type: Number, min: 0 }, // order subtotal above which shipping is free

    rateTiers: { type: [RateTierSchema], default: [] },

    handlingDays: { type: Number, default: 1, min: 0 }, // days to dispatch
    domesticOnly: { type: Boolean, default: true },
    internationalRate: { type: Number, min: 0 },

    isDefault: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ShippingProfileSchema.index({ sellerId: 1, deletedAt: 1 });

module.exports = mongoose.model('ShippingProfile', ShippingProfileSchema);
module.exports.CARRIERS = CARRIERS;
