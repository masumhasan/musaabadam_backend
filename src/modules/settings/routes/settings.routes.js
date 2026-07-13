const express = require('express');
const controller = require('../controllers/settings.controller');

const router = express.Router();

// Public — no auth required
router.get('/privacy-policy', controller.getPrivacyPolicy);
router.get('/terms', controller.getTerms);
router.get('/platform', controller.getPlatformSettings);
router.get('/faqs', controller.getFaqs);

module.exports = router;
