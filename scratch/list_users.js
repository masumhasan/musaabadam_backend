const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const listUsers = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://nanosoftsta_db_user:k39bo4R8JmUtbpUH@bidsrush.ylcd9oa.mongodb.net/';
  await mongoose.connect(uri, { dbName: 'bidsrush' });

  const User = require('../src/models/User');

  try {
    const users = await User.find().select('username email role status createdAt').lean();
    console.log('Users in DB:');
    console.log(users);
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.connection.close();
  }
};

listUsers();
