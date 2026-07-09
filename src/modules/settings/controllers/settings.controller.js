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

const getPlatformSettings = async (req, res, next) => {
  try {
    const PlatformSetting = require('../../../models/PlatformSetting');
    let doc = await PlatformSetting.findOne({ type: 'global' });
    if (!doc) {
      doc = await PlatformSetting.create({ type: 'global' });
    }
    res.json({ success: true, data: { settings: doc } });
  } catch (err) {
    next(err);
  }
};

const updatePlatformSettings = async (req, res, next) => {
  try {
    const PlatformSetting = require('../../../models/PlatformSetting');
    const { allowedTags, globalMutedWords, allowedLanguages } = req.body;
    let doc = await PlatformSetting.findOne({ type: 'global' });
    if (!doc) {
      doc = new PlatformSetting({ type: 'global' });
    }
    if (allowedTags !== undefined) doc.allowedTags = allowedTags;
    if (globalMutedWords !== undefined) doc.globalMutedWords = globalMutedWords;
    if (allowedLanguages !== undefined) doc.allowedLanguages = allowedLanguages;
    
    await doc.save();
    res.json({ success: true, data: { settings: doc } });
  } catch (err) {
    next(err);
  }
};

module.exports = { getPrivacyPolicy, getTerms, updatePrivacyPolicy, updateTerms, getPlatformSettings, updatePlatformSettings };
