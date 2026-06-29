const { success } = require('../../../utils/apiResponse');
const svc = require('../services/chat.service');
const { getIO } = require('../../../socket');

const history = async (req, res, next) => {
  try {
    const messages = await svc.getHistory(req.params.streamId, req.query);
    return success(res, { messages }, 'Chat history');
  } catch (err) {
    next(err);
  }
};

// REST fallback for sending a message (primary path is the socket).
const send = async (req, res, next) => {
  try {
    const message = await svc.createMessage({
      streamId: req.params.streamId,
      sender: req.user,
      text: req.body.text,
    });
    getIO()?.to(`stream:${req.params.streamId}`).emit('chat-message', message);
    return success(res, { message }, 'Message sent');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await svc.deleteMessage(req.params.messageId, req.user);
    getIO()?.to(`stream:${result.streamId}`).emit('message-deleted', result);
    return success(res, result, 'Message deleted');
  } catch (err) {
    next(err);
  }
};

module.exports = { history, send, remove };
