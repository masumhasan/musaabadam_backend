const { HTTP_STATUS } = require('../../../config/constants');
const svc = require('../services/stream.service');

const create = async (req, res, next) => {
  try {
    const stream = await svc.createStream(req.user, req.body);
    res.status(HTTP_STATUS.CREATED).json({ success: true, data: { stream } });
  } catch (err) { next(err); }
};

const start = async (req, res, next) => {
  try {
    const stream = await svc.startStream(req.user._id, req.params.streamId);
    res.json({ success: true, data: { stream } });
  } catch (err) { next(err); }
};

const end = async (req, res, next) => {
  try {
    const stream = await svc.endStream(req.user._id, req.params.streamId);
    res.json({ success: true, data: { stream } });
  } catch (err) { next(err); }
};

const cancel = async (req, res, next) => {
  try {
    const stream = await svc.cancelStream(req.user._id, req.params.streamId);
    res.json({ success: true, data: { stream } });
  } catch (err) { next(err); }
};

const join = async (req, res, next) => {
  try {
    const result = await svc.joinStream(req.params.streamId, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const list = async (req, res, next) => {
  try {
    const result = await svc.getPublicStreams(req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const myStreams = async (req, res, next) => {
  try {
    const result = await svc.getSellerStreams(req.user._id, req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const detail = async (req, res, next) => {
  try {
    const stream = await svc.getStream(req.params.streamId);
    res.json({ success: true, data: { stream } });
  } catch (err) { next(err); }
};

module.exports = { create, start, end, cancel, join, list, myStreams, detail };
