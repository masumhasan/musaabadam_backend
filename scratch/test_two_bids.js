const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const testTwoBids = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://nanosoftsta_db_user:k39bo4R8JmUtbpUH@bidsrush.ylcd9oa.mongodb.net/';
  await mongoose.connect(uri, { dbName: 'bidsrush' });

  const Product = require('../src/models/Product');
  const User = require('../src/models/User');
  const Bid = require('../src/models/Bid');
  const auctionService = require('../src/modules/auctions/services/auction.service');

  try {
    // Find the Pran Badam product
    const product = await Product.findOne({ title: /Pran Badam/i });
    if (!product) {
      console.log('Product "Pran Badam" not found.');
      return;
    }

    // Clean up any existing bids for this product to start fresh
    await Bid.deleteMany({ productId: product._id });

    // Find two distinct buyer users (not the seller)
    const buyers = await User.find({ _id: { $ne: product.sellerId } }).limit(2);
    if (buyers.length < 2) {
      console.log('Need at least 2 distinct buyer users in DB, found:', buyers.length);
      return;
    }

    const [buyerA, buyerB] = buyers;
    console.log('Buyer A:', buyerA.username, buyerA._id);
    console.log('Buyer B:', buyerB.username, buyerB._id);

    // Make sure product is set up as an auction running right now for testing
    const originalEndsAt = product.auctionEndsAt;
    const originalState = product.auctionState;
    const originalStatus = product.status;
    const originalHighBid = product.currentHighBid;
    const originalHighestBidder = product.highestBidderId;

    product.status = 'active';
    product.auctionState = 'running';
    product.currentHighBid = 0;
    product.highestBidderId = null;
    product.auctionEndsAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    await product.save();

    console.log('\n--- Attempting to place Bid 1 (Buyer A) ---');
    try {
      const bidResult1 = await auctionService.placeBid(buyerA._id, {
        productId: product._id,
        streamId: product.streamId,
        amount: 25,
      });
      console.log('Bid 1 placed successfully! Result:', bidResult1);
    } catch (err) {
      console.error('Bid 1 FAILED:', err.message, err.stack);
    }

    console.log('\n--- Attempting to place Bid 2 (Buyer B) ---');
    try {
      const bidResult2 = await auctionService.placeBid(buyerB._id, {
        productId: product._id,
        streamId: product.streamId,
        amount: 30,
      });
      console.log('Bid 2 placed successfully! Result:', bidResult2);
    } catch (err) {
      console.error('Bid 2 FAILED:', err.message, err.stack);
    }

    // Restore original product state
    product.auctionEndsAt = originalEndsAt;
    product.auctionState = originalState;
    product.status = originalStatus;
    product.currentHighBid = originalHighBid;
    product.highestBidderId = originalHighestBidder;
    await product.save();

    // Clean up our test bids
    await Bid.deleteMany({ productId: product._id });

  } catch (error) {
    console.error('General script error:', error);
  } finally {
    await mongoose.connection.close();
  }
};

testTwoBids();
