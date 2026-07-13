const LegalContent = require('../../../models/LegalContent');
const Faq = require('../../../models/Faq');

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

const listFaqs = async (type) => {
  const query = {};
  if (type) query.type = type;
  return Faq.find(query).sort({ order: 1, createdAt: 1 });
};

const createFaq = async (data, adminId) => {
  return Faq.create({ ...data, updatedBy: adminId });
};

const updateFaq = async (id, data, adminId) => {
  return Faq.findByIdAndUpdate(id, { ...data, updatedBy: adminId }, { new: true });
};

const deleteFaq = async (id) => {
  return Faq.findByIdAndDelete(id);
};

module.exports = {
  getContent,
  updateContent,
  listFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
};
