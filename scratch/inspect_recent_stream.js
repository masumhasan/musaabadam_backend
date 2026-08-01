const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const inspectStreamAndProduct = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://nanosoftsta_db_user:k39bo4R8JmUtbpUH@bidsrush.ylcd9oa.mongodb.net/';
  await mongoose.connect(uri, { dbName: 'bidsrush' });

  const Stream = require('../src/models/Stream');
  const Product = require('../src/models/Product');

  try {
    const stream = await Stream.findOne().sort({ createdAt: -1 });
    if (!stream) {
      console.log('No streams found.');
      return;
    }

    console.log('=== Recent Stream ===');
    console.log({
      id: stream._id,
      title: stream.title,
      status: stream.status,
      sellerId: stream.sellerId,
      pinnedProductId: stream.pinnedProductId,
      createdAt: stream.createdAt,
    });

    if (stream.pinnedProductId) {
      const product = await Product.findById(stream.pinnedProductId);
      if (product) {
        console.log('=== Pinned Product ===');
        console.log({
          id: product._id,
          title: product.title,
          sellerId: product.sellerId,
          listingType: product.listingType,
          status: product.status,
          startingPrice: product.startingPrice,
          reservePrice: product.reservePrice,
          currentHighBid: product.currentHighBid,
          auctionEndsAt: product.auctionEndsAt,
          auctionState: product.auctionState,
          streamId: product.streamId,
        });
      } else {
        console.log('Pinned product not found in database.');
      }
    } else {
      console.log('No pinned product on this stream.');
    }

    // Let's also check all active auction products
    const activeAuctions = await Product.find({
      listingType: 'auction',
      status: 'active',
      auctionState: 'running'
    });
    console.log(`\n=== Running Auction Products Count: ${activeAuctions.length} ===`);
    for (const p of activeAuctions) {
      console.log({
        id: p._id,
        title: p.title,
        sellerId: p.sellerId,
        currentHighBid: p.currentHighBid,
        auctionEndsAt: p.auctionEndsAt,
        streamId: p.streamId,
      });
    }

  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.connection.close();
  }
};

inspectStreamAndProduct();
