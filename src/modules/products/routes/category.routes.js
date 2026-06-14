const express = require('express');
const controller = require('../controllers/product.controller');
const { authenticateUser } = require('../../../middleware/auth');

const router = express.Router();

// Categories are publicly readable by authenticated users
// Creation / update / deletion is handled by the admin module
router.use(authenticateUser);

router.get('/', controller.listCategories);

module.exports = router;
