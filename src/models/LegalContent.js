const mongoose = require('mongoose');

const legalContentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['privacy_policy', 'terms_and_conditions'],
      unique: true,
      required: true,
    },
    content: {
      type: String,
      default: '',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LegalContent', legalContentSchema);
