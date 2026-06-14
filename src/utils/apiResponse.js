const { HTTP_STATUS } = require('../config/constants');

const success = (res, data = null, message = 'Success', statusCode = HTTP_STATUS.OK) => {
  const payload = { success: true, message };
  if (data !== null) payload.data = data;
  return res.status(statusCode).json(payload);
};

const created = (res, data = null, message = 'Created successfully') => {
  return success(res, data, message, HTTP_STATUS.CREATED);
};

const error = (res, message = 'An error occurred', statusCode = HTTP_STATUS.INTERNAL_ERROR, errors = null) => {
  const payload = { success: false, message };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
};

const notFound = (res, message = 'Resource not found') => {
  return error(res, message, HTTP_STATUS.NOT_FOUND);
};

const unauthorized = (res, message = 'Unauthorized') => {
  return error(res, message, HTTP_STATUS.UNAUTHORIZED);
};

const forbidden = (res, message = 'Forbidden') => {
  return error(res, message, HTTP_STATUS.FORBIDDEN);
};

const badRequest = (res, message = 'Bad request', errors = null) => {
  return error(res, message, HTTP_STATUS.BAD_REQUEST, errors);
};

const conflict = (res, message = 'Conflict') => {
  return error(res, message, HTTP_STATUS.CONFLICT);
};

const validationError = (res, errors) => {
  return error(res, 'Validation failed', HTTP_STATUS.UNPROCESSABLE, errors);
};

module.exports = { success, created, error, notFound, unauthorized, forbidden, badRequest, conflict, validationError };
