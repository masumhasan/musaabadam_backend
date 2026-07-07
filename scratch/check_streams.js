require('dotenv').config();
const mongoose = require('mongoose');
const Stream = require('../src/models/Stream');

async function run() {
  const url = process.env.MONGODB_URI;
  await mongoose.connect(url);
  
  const allStreams = await Stream.find({});
  console.log(`Found ${allStreams.length} total streams in DB:`);
  for (const s of allStreams) {
    console.log(`Stream: "${s.title}" (${s._id})`);
    console.log(`  status: ${s.status}`);
    console.log(`  recordingStatus: ${s.recordingStatus}`);
    console.log(`  recordingUrl: ${s.recordingUrl}`);
    console.log(`  isRecorded: ${s.isRecorded}`);
  }
  
  await mongoose.connection.close();
}

run();
