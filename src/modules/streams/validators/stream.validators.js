const { body, param, query } = require('express-validator');
const { STREAM_STATUS } = require('../../../models/Stream');

const streamIdParam = [
  param('streamId').isMongoId().withMessage('Invalid stream ID'),
];

const createStreamValidator = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 120 }),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
  body('categoryId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid category ID'),
  body('thumbnailUrl').optional({ values: 'falsy' }).isURL().withMessage('Invalid thumbnail URL'),
  body('tags').optional().isArray({ max: 10 }).withMessage('Max 10 tags'),
  body('tags.*').optional().isString().trim().isLength({ min: 1, max: 30 }),
  body('scheduledAt').optional({ values: 'falsy' }).isISO8601().withMessage('scheduledAt must be ISO 8601').toDate(),
  body('chatEnabled').optional().isBoolean().toBoolean(),
];

const listStreamsValidator = [
  query('status').optional({ values: 'falsy' }).isIn(Object.values(STREAM_STATUS)).withMessage('Invalid status'),
  query('categoryId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid category ID'),
  query('sellerId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid seller ID'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
];

const sellerStreamsValidator = [
  query('status').optional({ values: 'falsy' }).isIn(Object.values(STREAM_STATUS)).withMessage('Invalid status'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
];

module.exports = { streamIdParam, createStreamValidator, listStreamsValidator, sellerStreamsValidator };
