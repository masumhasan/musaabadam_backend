const mongoose = require('mongoose');

const PlatformSettingSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, unique: true }, // e.g. 'global'
    allowedTags: { type: [String], default: [] },
    globalMutedWords: { type: [String], default: [] },
    allowedLanguages: { type: [String], default: ['English'] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformSetting', PlatformSettingSchema);
