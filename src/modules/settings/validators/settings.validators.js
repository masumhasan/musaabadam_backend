const { body } = require('express-validator');

const updateLegalContentValidator = [
  body('content').isString().withMessage('Content must be a string').trim(),
];

module.exports = { updateLegalContentValidator };
