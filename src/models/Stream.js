const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const STREAM_STATUS = Object.freeze({
  DRAFT: 'draft', // created but not yet published/scheduled
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  ENDED: 'ended',
  CANCELLED: 'cancelled',
});

const STREAM_VISIBILITY = Object.freeze({
  PUBLIC: 'public',
  FOLLOWERS: 'followers', // only the seller's followers can see it
  PRIVATE: 'private', // only via direct link
});

// Lifecycle of the replay recording for a past show
const RECORDING_STATUS = Object.freeze({
  NONE: 'none',           // never recorded
  PROCESSING: 'processing', // stream ended, GetStream is still rendering the file
  READY: 'ready',         // recording stored in S3 and replayable
  FAILED: 'failed',       // recording could not be produced / stored
});

const StreamSchema = new mongoose.Schema(
  {
    sellerId: { type: ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    categoryId: { type: ObjectId, ref: 'Category' },
    thumbnailUrl: { type: String, trim: true },
    tags: { type: [String], default: [] },

    // Status lifecycle: draft → scheduled → live → ended | cancelled
    status: {
      type: String,
      enum: Object.values(STREAM_STATUS),
      default: STREAM_STATUS.SCHEDULED,
    },

    // Who can discover this show
    visibility: {
      type: String,
      enum: Object.values(STREAM_VISIBILITY),
      default: STREAM_VISIBILITY.PUBLIC,
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

    // Recording (replay) — stored in S3 once GetStream finishes rendering
    isRecorded: { type: Boolean, default: false },
    recordingUrl: { type: String },        // public S3 URL of the replay
    recordingKey: { type: String },        // S3 object key (for deletion)
    recordingStatus: {
      type: String,
      enum: Object.values(RECORDING_STATUS),
      default: RECORDING_STATUS.NONE,
    },
    recordingDurationSeconds: { type: Number },

    // Settings
    chatEnabled: { type: Boolean, default: true },
    cohostIds: [{ type: ObjectId, ref: 'User' }],

    // Live moderation
    bannedUserIds: [{ type: ObjectId, ref: 'User' }], // persistent per-stream bans
    pinnedMessageId: { type: ObjectId, ref: 'Message' }, // currently pinned chat message
    chatSlowModeSeconds: { type: Number, default: 0, min: 0 }, // 0 = off

    // Realtime viewer stats (currentViewers updated live; peak persisted)
    currentViewers: { type: Number, default: 0 },

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
// Replay browsing: list ended shows whose recording is ready, newest first
StreamSchema.index({ status: 1, recordingStatus: 1, endedAt: -1 });

module.exports = mongoose.model('Stream', StreamSchema);
module.exports.STREAM_STATUS = STREAM_STATUS;
module.exports.STREAM_VISIBILITY = STREAM_VISIBILITY;
module.exports.RECORDING_STATUS = RECORDING_STATUS;
