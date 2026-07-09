const { body, param, query } = require('express-validator');
const { STREAM_STATUS, STREAM_VISIBILITY } = require('../../../models/Stream');

const visibilityValues = Object.values(STREAM_VISIBILITY);

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
  body('visibility').optional({ values: 'falsy' }).isIn(visibilityValues).withMessage('Invalid visibility'),
  body('status').optional({ values: 'falsy' }).isIn([STREAM_STATUS.DRAFT, STREAM_STATUS.SCHEDULED]).withMessage('Invalid status'),
  body('videoPreviewUrl').optional({ values: 'falsy' }).isURL().withMessage('Invalid video URL'),
  body('primarySellingFormat').optional({ values: 'falsy' }).isIn(['auction', 'buy_it_now']).withMessage('Invalid format'),
  body('repeatOption').optional({ values: 'falsy' }).isIn(['doesNotRepeat', 'daily', 'weekly']).withMessage('Invalid repeat'),
  body('freePickup').optional().isBoolean().toBoolean(),
  body('explicitContent').optional().isBoolean().toBoolean(),
  body('primaryLanguage').optional({ values: 'falsy' }).isString(),
  body('mutedWords').optional().isArray().withMessage('Muted words must be array'),
  body('mutedWords.*').optional().isString().trim(),
  body('moderatorIds').optional().isArray(),
  body('moderatorIds.*').optional().isMongoId(),
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

const listReplaysValidator = [
  query('categoryId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid category ID'),
  query('sellerId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid seller ID'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
];

const updateStreamValidator = [
  ...streamIdParam,
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty').isLength({ max: 120 }),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
  body('categoryId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid category ID'),
  body('thumbnailUrl').optional({ values: 'falsy' }).isURL().withMessage('Invalid thumbnail URL'),
  body('tags').optional().isArray({ max: 10 }).withMessage('Max 10 tags'),
  body('tags.*').optional().isString().trim().isLength({ min: 1, max: 30 }),
  body('scheduledAt').optional({ values: 'falsy' }).isISO8601().withMessage('scheduledAt must be ISO 8601').toDate(),
  body('chatEnabled').optional().isBoolean().toBoolean(),
  body('visibility').optional({ values: 'falsy' }).isIn(visibilityValues).withMessage('Invalid visibility'),
  body('videoPreviewUrl').optional({ values: 'falsy' }).isURL().withMessage('Invalid video URL'),
  body('primarySellingFormat').optional({ values: 'falsy' }).isIn(['auction', 'buy_it_now']).withMessage('Invalid format'),
  body('repeatOption').optional({ values: 'falsy' }).isIn(['doesNotRepeat', 'daily', 'weekly']).withMessage('Invalid repeat'),
  body('freePickup').optional().isBoolean().toBoolean(),
  body('explicitContent').optional().isBoolean().toBoolean(),
  body('primaryLanguage').optional({ values: 'falsy' }).isString(),
  body('mutedWords').optional().isArray().withMessage('Muted words must be array'),
  body('mutedWords.*').optional().isString().trim(),
  body('moderatorIds').optional().isArray(),
  body('moderatorIds.*').optional().isMongoId(),
];

const createAuctionValidator = [
  body('productId').isMongoId().withMessage('productId must be a valid Mongo ID'),
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 120 }),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
  body('categoryId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid category ID'),
  body('thumbnailUrl').optional({ values: 'falsy' }).isURL().withMessage('Invalid thumbnail URL'),
  body('tags').optional().isArray({ max: 10 }).withMessage('Max 10 tags'),
  body('tags.*').optional().isString().trim().isLength({ min: 1, max: 30 }),
  body('chatEnabled').optional().isBoolean().toBoolean(),
];

module.exports = { streamIdParam, createStreamValidator, createAuctionValidator, updateStreamValidator, listStreamsValidator, listReplaysValidator, sellerStreamsValidator };
