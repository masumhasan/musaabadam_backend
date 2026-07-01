const Notification = require('../../../models/Notification');
const User = require('../../../models/User');
const Follower = require('../../../models/Follower');
const { sendPush } = require('../../../utils/pushProvider');
const logger = require('../../../utils/logger');

const serialize = (n) => ({
  id: String(n._id),
  type: n.type,
  title: n.title,
  body: n.body ?? null,
  actor: n.actorId
    ? { userId: String(n.actorId), displayName: n.actorName ?? null, avatarUrl: n.actorAvatarUrl ?? null }
    : null,
  data: {
    streamId: n.data?.streamId ? String(n.data.streamId) : null,
    productId: n.data?.productId ? String(n.data.productId) : null,
    orderId: n.data?.orderId ? String(n.data.orderId) : null,
    giveawayId: n.data?.giveawayId ? String(n.data.giveawayId) : null,
  },
  isRead: n.isRead,
  createdAt: n.createdAt,
});

// Emit a realtime notification to a user's personal socket room + push to device.
const deliver = async (notification) => {
  const payload = serialize(notification);
  try {
    // Lazy require avoids a socket <-> service require cycle at module load.
    // eslint-disable-next-line global-require
    const { getIO } = require('../../../socket');
    getIO()?.to(`user:${notification.userId}`).emit('notification', payload);
  } catch (err) {
    logger.error('Notification socket emit failed', { error: err.message });
  }

  try {
    const user = await User.findById(notification.userId).select('fcmTokens');
    if (user?.fcmTokens?.length) {
      await sendPush({
        tokens: user.fcmTokens,
        title: notification.title,
        body: notification.body,
        data: { type: notification.type, notificationId: String(notification._id) },
      });
    }
  } catch (err) {
    logger.error('Notification push failed', { error: err.message });
  }

  return payload;
};

// Create a single notification (persists + delivers). Never throws to callers —
// notifications must not break the primary business action.
const notify = async (userId, { type, title, body, actor, data } = {}) => {
  try {
    if (!userId) return null;
    const notification = await Notification.create({
      userId,
      type,
      title,
      body,
      actorId: actor?.userId ?? null,
      actorName: actor?.displayName ?? null,
      actorAvatarUrl: actor?.avatarUrl ?? null,
      data: data ?? {},
    });
    await deliver(notification);
    return notification;
  } catch (err) {
    logger.error('notify() failed', { error: err.message, type });
    return null;
  }
};

// Fan out the same notification to many recipients (e.g. a seller's followers).
const notifyMany = async (userIds, payload) => {
  const unique = [...new Set(userIds.map(String))];
  await Promise.all(unique.map((uid) => notify(uid, payload)));
  return unique.length;
};

// Notify all of a seller's followers (used for live-started / auction-started).
const notifyFollowers = async (sellerId, payload) => {
  const followers = await Follower.find({ followingId: sellerId }).select('followerId');
  return notifyMany(followers.map((f) => f.followerId), payload);
};

// ─── Reads ────────────────────────────────────────────────────────────────────

const list = async (userId, { page = 1, limit = 20, unreadOnly = false } = {}) => {
  const query = { userId };
  if (unreadOnly === true || unreadOnly === 'true') query.isRead = false;
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Notification.countDocuments(query),
    Notification.countDocuments({ userId, isRead: false }),
  ]);
  return {
    notifications: items.map(serialize),
    total,
    unreadCount,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  };
};

const unreadCount = async (userId) => Notification.countDocuments({ userId, isRead: false });

const markRead = async (userId, notificationId) => {
  await Notification.updateOne({ _id: notificationId, userId }, { $set: { isRead: true, readAt: new Date() } });
  return { unreadCount: await unreadCount(userId) };
};

const markAllRead = async (userId) => {
  await Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
  return { unreadCount: 0 };
};

module.exports = { notify, notifyMany, notifyFollowers, list, unreadCount, markRead, markAllRead };
