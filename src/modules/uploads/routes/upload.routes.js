const { Router } = require('express');
const { body } = require('express-validator');
const { authenticateUser } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const ctrl = require('../controllers/upload.controller');

const router = Router();

router.post(
  '/presigned-url',
  authenticateUser,
  body('folder')
    .isIn(['profile', 'product', 'stream_thumbnail'])
    .withMessage('Invalid folder. Allowed: profile, product, stream_thumbnail'),
  body('contentType').isString().notEmpty().withMessage('contentType is required'),
  body('fileSize').isInt({ min: 1 }).withMessage('fileSize must be a positive integer'),
  validate,
  ctrl.getUploadUrl
);

module.exports = router;
