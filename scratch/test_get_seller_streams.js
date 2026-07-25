const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const run = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://nanosoftsta_db_user:k39bo4R8JmUtbpUH@bidsrush.ylcd9oa.mongodb.net/';
  await mongoose.connect(uri, { dbName: 'bidsrush' });

  const streamService = require('../src/modules/streams/services/stream.service');
  
  // Find one stream to get a valid seller ID
  const Stream = require('../src/models/Stream');
  const sampleStream = await Stream.findOne({ deletedAt: null });
  if (!sampleStream) {
    console.log('No streams found in database.');
    mongoose.connection.close();
    return;
  }
  
  console.log('Querying streams for sellerId:', sampleStream.sellerId);
  const result = await streamService.getSellerStreams(sampleStream.sellerId, { status: 'ended' });
  console.log('getSellerStreams output structure:');
  console.log('Total:', result.total);
  if (result.streams.length > 0) {
    const s = result.streams[0];
    console.log('Stream title:', s.title);
    console.log('Stream status:', s.status);
    console.log('Stream sellerId populated:', typeof s.sellerId, JSON.stringify(s.sellerId));
  } else {
    console.log('No ended streams found for this seller. Fetching all:');
    const resultAll = await streamService.getSellerStreams(sampleStream.sellerId, {});
    if (resultAll.streams.length > 0) {
      const s = resultAll.streams[0];
      console.log('Stream title:', s.title);
      console.log('Stream status:', s.status);
      console.log('Stream sellerId populated:', typeof s.sellerId, JSON.stringify(s.sellerId));
    }
  }

  mongoose.connection.close();
};

run().catch(console.error);
