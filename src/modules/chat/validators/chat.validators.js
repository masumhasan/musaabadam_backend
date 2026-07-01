const { param, body, query } = require('express-validator');

const streamIdParam = [param('streamId').isMongoId().withMessage('Invalid stream ID')];
const messageIdParam = [param('messageId').isMongoId().withMessage('Invalid message ID')];

const historyValidator = [
  ...streamIdParam,
  query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 100 }).withMessage('limit must be 1–100'),
  query('before').optional({ values: 'falsy' }).isISO8601().withMessage('before must be an ISO date'),
];

const sendValidator = [
  ...streamIdParam,
  body('text').isString().trim().isLength({ min: 1, max: 500 }).withMessage('text must be 1–500 chars'),
  body('replyTo').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid replyTo message ID'),
];

module.exports = { streamIdParam, messageIdParam, historyValidator, sendValidator };
