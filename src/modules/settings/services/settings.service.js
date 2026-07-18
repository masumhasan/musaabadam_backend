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

const PremierShopSetting = require('../../../models/PremierShopSetting');

const getPremierShopSettings = async () => {
  let doc = await PremierShopSetting.findOne({ type: 'global' });
  if (!doc) {
    doc = await PremierShopSetting.create({ type: 'global' });
  }
  return doc;
};

const updatePremierShopSettings = async (data) => {
  let doc = await PremierShopSetting.findOne({ type: 'global' });
  if (!doc) {
    doc = new PremierShopSetting({ type: 'global' });
  }

  const fields = [
    'activeDays',
    'hostedShows',
    'completedOrders',
    'gmvAmount',
    'timelyShippingPercent',
    'shippingHours',
    'orderReliabilityPercent',
    'policyAdherenceText',
    'commissionDiscountPercent',
    'perks',
  ];

  fields.forEach((field) => {
    if (data[field] !== undefined) {
      doc[field] = data[field];
    }
  });

  await doc.save();
  return doc;
};

module.exports = {
  getContent,
  updateContent,
  listFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  getPremierShopSettings,
  updatePremierShopSettings,
};

