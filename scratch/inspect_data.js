const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGODB_URI;

mongoose.connect(uri, { dbName: 'bidsrush' }).then(async () => {
  console.log('Connected to MongoDB!');
  const Tip = require('../src/models/Tip');
  const Wallet = require('../src/models/Wallet');
  const LedgerEntry = require('../src/models/LedgerEntry');

  // Let's find successful tips
  const tips = await Tip.find({ status: 'succeeded' }).lean();
  console.log('--- Successful Tips ---');
  console.log(tips);

  // Let's find wallets
  const wallets = await Wallet.find().lean();
  console.log('--- Wallets ---');
  console.log(wallets);

  // Let's find ledger entries for the seller
  if (wallets.length > 0) {
    const userId = wallets[0].userId;
    const ledger = await LedgerEntry.find({ userId }).sort({ createdAt: -1 }).limit(10).lean();
    console.log('--- Recent Ledger Entries for', userId, '---');
    console.log(ledger);
  }

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
