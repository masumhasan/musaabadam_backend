const settingsService = require('../services/settings.service');

// ── Public GET ────────────────────────────────────────────────────────────────

const getPrivacyPolicy = async (req, res, next) => {
  try {
    const result = await settingsService.getContent('privacy_policy');
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getTerms = async (req, res, next) => {
  try {
    const result = await settingsService.getContent('terms_and_conditions');
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// ── Admin PUT (requires authenticateAdmin — enforced in admin.routes.js) ──────

const updatePrivacyPolicy = async (req, res, next) => {
  try {
    const doc = await settingsService.updateContent(
      'privacy_policy',
      req.body.content,
      req.admin._id
    );
    res.json({ success: true, data: { content: doc.content, updatedAt: doc.updatedAt } });
  } catch (err) {
    next(err);
  }
};

const updateTerms = async (req, res, next) => {
  try {
    const doc = await settingsService.updateContent(
      'terms_and_conditions',
      req.body.content,
      req.admin._id
    );
    res.json({ success: true, data: { content: doc.content, updatedAt: doc.updatedAt } });
  } catch (err) {
    next(err);
  }
};

module.exports = { getPrivacyPolicy, getTerms, updatePrivacyPolicy, updateTerms };
