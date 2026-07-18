const mongoose = require('mongoose');

const PremierShopSettingSchema = new mongoose.Schema(
  {
    type: { type: String, default: 'global', unique: true },
    // Sales & Activity Volume criteria
    activeDays: { type: Number, default: 90 },
    hostedShows: { type: Number, default: 10 },
    completedOrders: { type: Number, default: 250 },
    gmvAmount: { type: Number, default: 50000 },

    // Fulfillment & Service Excellence criteria
    timelyShippingPercent: { type: Number, default: 95 },
    shippingHours: { type: Number, default: 48 },
    orderReliabilityPercent: { type: Number, default: 99 },
    policyAdherenceText: {
      type: String,
      default: "Full compliance with BidsRush Community Guidelines & Trust Standards",
    },

    // Perks & Discounts
    commissionDiscountPercent: { type: Number, default: 10 },
    perks: {
      type: [String],
      default: [
        "10% Commission Discount on standard platform fees",
        "Premier Shop Badge on your profile and show thumbnails",
        "Boosted search placement & recommendations",
        "Prioritized Dedicated Seller Support",
      ],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PremierShopSetting', PremierShopSettingSchema);
