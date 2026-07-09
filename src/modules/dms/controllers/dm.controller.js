const dmService = require('../services/dm.service');
const { success, created } = require('../../../utils/apiResponse');
const { getIO } = require('../../../socket');

const sendDirectMessage = async (req, res, next) => {
  try {
    const { text } = req.body;
    const { partnerId } = req.params;
    const message = await dmService.sendMessage(req.user._id, partnerId, text);
    
    // Emit real-time event to the recipient's personal room
    const io = getIO();
    if (io) {
      io.to(`user:${partnerId}`).emit('dm-message', message);
    }
    
    return created(res, message, 'Message sent successfully');
  } catch (err) {
    next(err);
  }
};

const getDirectMessages = async (req, res, next) => {
  try {
    const { partnerId } = req.params;
    const result = await dmService.getMessages(req.user._id, partnerId, req.query);
    return success(res, result, 'Messages retrieved');
  } catch (err) {
    next(err);
  }
};

const getInboxConversations = async (req, res, next) => {
  try {
    const conversations = await dmService.getConversations(req.user._id);
    return success(res, { conversations }, 'Conversations retrieved');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendDirectMessage,
  getDirectMessages,
  getInboxConversations,
};
