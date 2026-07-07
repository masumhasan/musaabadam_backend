const express = require('express');
const { body, param } = require('express-validator');
const controller = require('../controllers/dm.controller');
const validate = require('../../../middleware/validate');
const { authenticateUser } = require('../../../middleware/auth');

const router = express.Router();

router.use(authenticateUser);

router.get('/conversations', controller.getInboxConversations);

router.get(
  '/messages/:partnerId',
  param('partnerId').isMongoId().withMessage('Invalid recipient ID'),
  validate,
  controller.getDirectMessages
);

router.post(
  '/messages/:partnerId',
  param('partnerId').isMongoId().withMessage('Invalid recipient ID'),
  body('text').trim().notEmpty().withMessage('Message text is required'),
  validate,
  controller.sendDirectMessage
);

module.exports = router;
