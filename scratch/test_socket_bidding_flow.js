const mongoose = require('mongoose');
const { io } = require('socket.io-client');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const testSocketBidding = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://nanosoftsta_db_user:k39bo4R8JmUtbpUH@bidsrush.ylcd9oa.mongodb.net/';
  await mongoose.connect(uri, { dbName: 'bidsrush' });

  const User = require('../src/models/User');
  const Product = require('../src/models/Product');
  const Stream = require('../src/models/Stream');
  const { generateAccessToken } = require('../src/utils/jwtService');

  try {
    // 1. Find buyer user
    const buyer = await User.findOne({ username: 'hasina_pn9h' });
    if (!buyer) {
      console.log('Buyer hasina_pn9h not found');
      return;
    }

    // 2. Generate token
    const token = generateAccessToken({ sub: String(buyer._id), type: 'access' });
    console.log(`Generated JWT for ${buyer.username}: ${token}`);

    // 3. Find Pran Badam product and stream
    const product = await Product.findOne({ title: /Pran Badam/i });
    if (!product) {
      console.log('Pran Badam product not found');
      return;
    }

    const stream = await Stream.findById(product.streamId || '6a6d4fac5bda16304e72facb');
    if (!stream) {
      console.log('Stream not found');
      return;
    }

    // Set product active and running for this test
    const originalEndsAt = product.auctionEndsAt;
    const originalState = product.auctionState;
    const originalStatus = product.status;
    const originalHighBid = product.currentHighBid;
    const originalHighestBidder = product.highestBidderId;

    product.status = 'active';
    product.auctionState = 'running';
    product.auctionEndsAt = new Date(Date.now() + 10 * 60 * 1000);
    await product.save();

    // Also make sure the stream status is live
    const originalStreamStatus = stream.status;
    stream.status = 'live';
    await stream.save();

    console.log('\nConnecting to local socket server at http://localhost:5000...');
    const socket = io('http://localhost:5000', {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Socket connected successfully! ID:', socket.id);
      
      // Join stream
      console.log(`Joining stream ${stream._id}...`);
      socket.emit('join-stream', { streamId: String(stream._id) });
    });

    socket.on('joined', (data) => {
      console.log('Joined stream response:', data);

      // Emit place-bid
      const bidAmount = (product.currentHighBid || product.startingPrice || 0) + 2;
      console.log(`Placing bid: amount=${bidAmount}, productId=${product._id}, streamId=${stream._id}`);
      socket.emit('place-bid', {
        streamId: String(stream._id),
        productId: String(product._id),
        amount: bidAmount,
      });
    });

    socket.on('bid-updated', (data) => {
      console.log('SUCCESS: bid-updated received:', data);
      cleanupAndExit();
    });

    socket.on('bid-error', (data) => {
      console.log('ERROR: bid-error received:', data);
      cleanupAndExit();
    });

    socket.on('error', (data) => {
      console.log('ERROR: general error received:', data);
      cleanupAndExit();
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      cleanupAndExit();
    });

    const cleanupAndExit = async () => {
      console.log('\nCleaning up database state...');
      product.auctionEndsAt = originalEndsAt;
      product.auctionState = originalState;
      product.status = originalStatus;
      product.currentHighBid = originalHighBid;
      product.highestBidderId = originalHighestBidder;
      await product.save();

      stream.status = originalStreamStatus;
      await stream.save();

      socket.disconnect();
      await mongoose.connection.close();
      console.log('Done.');
      process.exit(0);
    };

    // Timeout safety net
    setTimeout(() => {
      console.log('Test timed out.');
      cleanupAndExit();
    }, 15000);

  } catch (error) {
    console.error('Script error:', error);
    await mongoose.connection.close();
  }
};

testSocketBidding();
