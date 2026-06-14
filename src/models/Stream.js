const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const STREAM_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  ENDED: 'ended',
  CANCELLED: 'cancelled',
});

const StreamSchema = new mongoose.Schema(
  {
    sellerId: { type: ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    categoryId: { type: ObjectId, ref: 'Category' },
    thumbnailUrl: { type: String, trim: true },
    tags: { type: [String], default: [] },

    // Status lifecycle: scheduled → live → ended | cancelled
    status: {
      type: String,
      enum: Object.values(STREAM_STATUS),
      default: STREAM_STATUS.SCHEDULED,
    },

    // GetStream call reference
    callId: { type: String, required: true, unique: true },
    callType: { type: String, default: 'livestream' },

    // Timing
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    endedAt: { type: Date },

    // Stats (updated incrementally)
    peakViewerCount: { type: Number, default: 0 },
    totalViewers: { type: Number, default: 0 },

    // Pinned products shown during stream
    pinnedProducts: [{ type: ObjectId, ref: 'Product' }],

    // Recording
    isRecorded: { type: Boolean, default: false },
    recordingUrl: { type: String },

    // Settings
    chatEnabled: { type: Boolean, default: true },
    cohostIds: [{ type: ObjectId, ref: 'User' }],

    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

StreamSchema.virtual('durationSeconds').get(function () {
  if (!this.startedAt || !this.endedAt) return null;
  return Math.floor((this.endedAt - this.startedAt) / 1000);
});

StreamSchema.virtual('isLive').get(function () {
  return this.status === STREAM_STATUS.LIVE;
});

// Indexes
StreamSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
StreamSchema.index({ status: 1, scheduledAt: 1 });
StreamSchema.index({ status: 1, startedAt: -1 });
StreamSchema.index({ deletedAt: 1 });
StreamSchema.index({ tags: 1 });

module.exports = mongoose.model('Stream', StreamSchema);
module.exports.STREAM_STATUS = STREAM_STATUS;
