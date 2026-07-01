const { success, created } = require('../../../utils/apiResponse');
const svc = require('../services/giveaway.service');
const { getIO } = require('../../../socket');

const emit = (streamId, event, payload) => {
  if (streamId) getIO()?.to(`stream:${streamId}`).emit(event, payload);
};

const create = async (req, res, next) => {
  try {
    const g = await svc.createGiveaway(req.user._id, req.body);
    emit(g.streamId, 'giveaway-started', g);
    return created(res, { giveaway: g }, 'Giveaway created');
  } catch (err) {
    next(err);
  }
};

const join = async (req, res, next) => {
  try {
    const g = await svc.joinGiveaway(req.user._id, req.params.giveawayId);
    emit(g.streamId, 'giveaway-joined', { giveawayId: g.id, entryCount: g.entryCount });
    return success(res, { giveaway: g }, 'Joined giveaway');
  } catch (err) {
    next(err);
  }
};

const draw = async (req, res, next) => {
  try {
    const result = await svc.drawWinner(req.user._id, req.params.giveawayId);
    emit(result.streamId, 'giveaway-winner', result);
    return success(res, { result }, 'Winner drawn');
  } catch (err) {
    next(err);
  }
};

const cancel = async (req, res, next) => {
  try {
    const g = await svc.cancelGiveaway(req.user._id, req.params.giveawayId);
    emit(g.streamId, 'giveaway-cancelled', { giveawayId: g.id });
    return success(res, { giveaway: g }, 'Giveaway cancelled');
  } catch (err) {
    next(err);
  }
};

const streamGiveaways = async (req, res, next) => {
  try {
    const giveaways = await svc.getStreamGiveaways(req.params.streamId);
    return success(res, { giveaways }, 'Stream giveaways');
  } catch (err) {
    next(err);
  }
};

module.exports = { create, join, draw, cancel, streamGiveaways };
