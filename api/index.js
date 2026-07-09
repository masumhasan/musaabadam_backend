const app = require('../src/app');
const connectDB = require('../src/config/database');

let isConnected = false;

const connectToDB = async () => {
  if (isConnected) return;
  await connectDB();
  isConnected = true;
};

// Vercel serverless function entrypoint
module.exports = async (req, res) => {
  await connectToDB();
  return app(req, res);
};
