const { validationResult } = require('express-validator');
const { HTTP_STATUS } = require('../config/constants');

// Reads express-validator results and returns 422 with field errors if any
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HTTP_STATUS.UNPROCESSABLE).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = validate;
