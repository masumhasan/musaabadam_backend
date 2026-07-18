const express = require('express');
const controller = require('../controllers/settings.controller');

const router = express.Router();

const { authenticateUser } = require('../../../middleware/auth');

// Public — no auth required
router.get('/privacy-policy', controller.getPrivacyPolicy);
router.get('/terms', controller.getTerms);
router.get('/platform', controller.getPlatformSettings);
router.get('/faqs', controller.getFaqs);
router.get('/premier-shop', controller.getPremierShopSettings);

// Authenticated seller premier shop status
router.get('/seller-premier-shop-status', authenticateUser, controller.getSellerPremierShopStatus);

module.exports = router;


