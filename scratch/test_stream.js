const mongoose = require('mongoose');
const { StreamClient } = require('@stream-io/node-sdk');
require('dotenv').config({ path: '../.env' });

const testStream = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://nanosoftsta_db_user:k39bo4R8JmUtbpUH@bidsrush.ylcd9oa.mongodb.net/';
  await mongoose.connect(uri, { dbName: 'bidsrush' });

  const Stream = require('../src/models/Stream');
  const stream = await Stream.findById('6a48af73bb1aef1776cf2c46');
  if (!stream) {
    console.log('Stream not found.');
    mongoose.connection.close();
    return;
  }

  console.log(`Checking stream: ID=${stream._id}, callId=${stream.callId}, callType=${stream.callType}, status=${stream.status}`);

  const key = process.env.STREAM_API_KEY || 'nyetbgnka76c';
  const secret = process.env.STREAM_API_SECRET || '4g9g8kvjr9p3kvjfssvwqxjj22qc4agjs6errrdftfa993e2gqx5dvh9veppgrs3';

  const client = new StreamClient(key, secret);
  try {
    const call = client.video.call(stream.callType, stream.callId);
    const response = await call.get();
    console.log('GetStream Call Info:', JSON.stringify(response.call, null, 2));
  } catch (err) {
    console.error('Failed to get call info from GetStream:', err.message);
  }

  mongoose.connection.close();
};

testStream();
