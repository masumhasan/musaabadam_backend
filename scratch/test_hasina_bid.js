const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const testHasinaBid = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://nanosoftsta_db_user:k39bo4R8JmUtbpUH@bidsrush.ylcd9oa.mongodb.net/';
  await mongoose.connect(uri, { dbName: 'bidsrush' });

  const Product = require('../src/models/Product');
  const User = require('../src/models/User');
  const auctionService = require('../src/modules/auctions/services/auction.service');

  try {
    const product = await Product.findOne({ title: /Pran Badam/i });
    const buyer = await User.findOne({ username: 'hasina_pn9h' });

    if (!product || !buyer) {
      console.log('Product or Buyer not found.');
      return;
    }

    // Set product active and running
    const originalEndsAt = product.auctionEndsAt;
    const originalState = product.auctionState;
    const originalStatus = product.status;
    const originalHighBid = product.currentHighBid;
    const originalHighestBidder = product.highestBidderId;

    product.status = 'active';
    product.auctionState = 'running';
    product.auctionEndsAt = new Date(Date.now() + 10 * 60 * 1000);
    await product.save();

    console.log(`Attempting bid for ${buyer.username} (${buyer._id})`);
    try {
      const result = await auctionService.placeBid(buyer._id, {
        productId: product._id,
        streamId: product.streamId,
        amount: (product.currentHighBid || product.startingPrice || 0) + 5,
      });
      console.log('Bid placed successfully:', result);
    } catch (err) {
      console.error('Bid failed!');
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);
    }

    // Restore
    product.auctionEndsAt = originalEndsAt;
    product.auctionState = originalState;
    product.status = originalStatus;
    product.currentHighBid = originalHighBid;
    product.highestBidderId = originalHighestBidder;
    await product.save();

  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.connection.close();
  }
};

testHasinaBid();
