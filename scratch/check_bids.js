const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const checkBids = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://nanosoftsta_db_user:k39bo4R8JmUtbpUH@bidsrush.ylcd9oa.mongodb.net/';
  await mongoose.connect(uri, { dbName: 'bidsrush' });

  const Bid = require('../src/models/Bid');
  const Product = require('../src/models/Product');

  try {
    const product = await Product.findOne({ title: /Pran Badam/i });
    if (!product) {
      console.log('Product not found.');
      return;
    }

    const bids = await Bid.find({ productId: product._id }).lean();
    console.log(`Bids for product ${product.title} (${product._id}):`);
    console.log(bids);
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.connection.close();
  }
};

checkBids();
