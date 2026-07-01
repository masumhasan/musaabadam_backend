const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// A single user's entry into a giveaway. One entry per (giveaway, user).
const GiveawayEntrySchema = new mongoose.Schema(
  {
    giveawayId: { type: ObjectId, ref: 'Giveaway', required: true },
    userId: { type: ObjectId, ref: 'User', required: true },
    userName: { type: String, trim: true },
  },
  { timestamps: true }
);

GiveawayEntrySchema.index({ giveawayId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('GiveawayEntry', GiveawayEntrySchema);
