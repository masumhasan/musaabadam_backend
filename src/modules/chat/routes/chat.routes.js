const { Router } = require('express');
const { authenticateUser } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const ctrl = require('../controllers/chat.controller');
const { historyValidator, sendValidator, messageIdParam } = require('../validators/chat.validators');

const router = Router();

router.get('/streams/:streamId/messages', authenticateUser, ...historyValidator, validate, ctrl.history);
router.post('/streams/:streamId/messages', authenticateUser, ...sendValidator, validate, ctrl.send);
router.delete('/messages/:messageId', authenticateUser, ...messageIdParam, validate, ctrl.remove);

module.exports = router;
