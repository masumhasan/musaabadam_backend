const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const listStreams = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://nanosoftsta_db_user:k39bo4R8JmUtbpUH@bidsrush.ylcd9oa.mongodb.net/';
  await mongoose.connect(uri, { dbName: 'bidsrush' });
  const Stream = require('../src/models/Stream');
  const streams = await Stream.find({ deletedAt: null }).sort({ createdAt: -1 }).limit(10);
  console.log('Latest 10 streams:');
  for (const s of streams) {
    console.log(`ID: ${s._id}, title: ${s.title}, status: ${s.status}, callId: ${s.callId}, createdAt: ${s.createdAt}`);
  }
  mongoose.connection.close();
};

listStreams();
