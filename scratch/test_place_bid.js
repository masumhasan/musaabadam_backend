const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const testPlaceBid = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://nanosoftsta_db_user:k39bo4R8JmUtbpUH@bidsrush.ylcd9oa.mongodb.net/';
  await mongoose.connect(uri, { dbName: 'bidsrush' });

  const Product = require('../src/models/Product');
  const User = require('../src/models/User');
  const auctionService = require('../src/modules/auctions/services/auction.service');

  try {
    // Find the Pran Badam product
    const product = await Product.findOne({ title: /Pran Badam/i });
    if (!product) {
      console.log('Product "Pran Badam" not found.');
      return;
    }

    console.log('--- Product Details ---');
    console.log({
      id: product._id,
      title: product.title,
      sellerId: product.sellerId,
      listingType: product.listingType,
      status: product.status,
      startingPrice: product.startingPrice,
      reservePrice: product.reservePrice,
      currentHighBid: product.currentHighBid,
      highestBidderId: product.highestBidderId,
      auctionEndsAt: product.auctionEndsAt,
      auctionState: product.auctionState,
      streamId: product.streamId,
    });

    // Find a buyer user (not the seller)
    const buyer = await User.findOne({ _id: { $ne: product.sellerId } });
    if (!buyer) {
      console.log('No potential buyer user found in the DB.');
      return;
    }

    console.log('--- Buyer Details ---');
    console.log({
      id: buyer._id,
      username: buyer.username,
      displayName: buyer.displayName,
    });

    // Make sure product is set up as an auction running right now for testing
    // Save original state so we don't mess up the DB permanently
    const originalEndsAt = product.auctionEndsAt;
    const originalState = product.auctionState;
    const originalStatus = product.status;

    product.status = 'active';
    product.auctionState = 'running';
    product.auctionEndsAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    await product.save();

    console.log('\n--- Attempting to place bid ---');
    try {
      const bidResult = await auctionService.placeBid(buyer._id, {
        productId: product._id,
        streamId: product.streamId,
        amount: (product.currentHighBid || product.startingPrice || 0) + 5, // place a valid bid higher than current
      });
      console.log('Bid placed successfully! Result:', bidResult);
    } catch (err) {
      console.error('FAILED to place bid.');
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);
      console.error('Is Operational:', err.isOperational);
    }

    // Restore original product state
    product.auctionEndsAt = originalEndsAt;
    product.auctionState = originalState;
    product.status = originalStatus;
    await product.save();

  } catch (error) {
    console.error('General script error:', error);
  } finally {
    await mongoose.connection.close();
  }
};

testPlaceBid();
