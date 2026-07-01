const { success } = require('../../../utils/apiResponse');
const svc = require('../services/notification.service');

const list = async (req, res, next) => {
  try {
    const result = await svc.list(req.user._id, req.query);
    return success(res, result, 'Notifications');
  } catch (err) {
    next(err);
  }
};

const unreadCount = async (req, res, next) => {
  try {
    const count = await svc.unreadCount(req.user._id);
    return success(res, { unreadCount: count }, 'Unread count');
  } catch (err) {
    next(err);
  }
};

const markRead = async (req, res, next) => {
  try {
    const result = await svc.markRead(req.user._id, req.params.notificationId);
    return success(res, result, 'Marked read');
  } catch (err) {
    next(err);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    const result = await svc.markAllRead(req.user._id);
    return success(res, result, 'All marked read');
  } catch (err) {
    next(err);
  }
};

module.exports = { list, unreadCount, markRead, markAllRead };
