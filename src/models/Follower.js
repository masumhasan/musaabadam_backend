const mongoose = require('mongoose');

const FollowerSchema = new mongoose.Schema(
  {
    followerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    followingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Unique relationship constraint
FollowerSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
// Efficient reverse lookup (who follows this user)
FollowerSchema.index({ followingId: 1, createdAt: -1 });
// Efficient forward lookup (who this user follows)
FollowerSchema.index({ followerId: 1, createdAt: -1 });

module.exports = mongoose.model('Follower', FollowerSchema);
