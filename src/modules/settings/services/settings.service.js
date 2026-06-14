const LegalContent = require('../../../models/LegalContent');

const getContent = async (type) => {
  const doc = await LegalContent.findOne({ type });
  return { content: doc ? doc.content : '', updatedAt: doc ? doc.updatedAt : null };
};

const updateContent = async (type, content, adminId) => {
  const doc = await LegalContent.findOneAndUpdate(
    { type },
    { content, updatedBy: adminId },
    { new: true, upsert: true }
  );
  return doc;
};

module.exports = { getContent, updateContent };
