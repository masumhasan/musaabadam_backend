const offerService = require('../services/offer.service');
const { success, created } = require('../../../utils/apiResponse');

const create = async (req, res, next) => {
  try {
    const offer = await offerService.createOffer(req.user._id, req.body);
    return created(res, offer, 'Offer created successfully');
  } catch (err) {
    next(err);
  }
};

const buyerOffers = async (req, res, next) => {
  try {
    const data = await offerService.getBuyerOffers(req.user._id, req.query);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const sellerOffers = async (req, res, next) => {
  try {
    const data = await offerService.getSellerOffers(req.user._id, req.query);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const offer = await offerService.updateOfferStatus(req.user._id, req.params.offerId, req.body.status);
    
    const { getIO } = require('../../../socket');
    const io = getIO();
    if (io) {
      // Notify the buyer that their offer was updated
      io.to(`user:${offer.buyerId}`).emit('offer-updated', offer);
    }
    
    return success(res, offer, `Offer status updated to ${req.body.status}`);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  create,
  buyerOffers,
  sellerOffers,
  updateStatus,
};
