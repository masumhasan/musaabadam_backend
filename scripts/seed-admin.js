/**
 * Creates the initial super_admin account.
 * Run once: node scripts/seed-admin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');
const { ADMIN_ROLES, ADMIN_PERMISSIONS } = require('../src/config/constants');

const SEEDS = [
  {
    email: 'mail.sparktechai@gmail.com',
    passwordHash: 'Test@123',
    firstName: 'SparkTech',
    lastName: 'Admin',
    role: ADMIN_ROLES.SUPER_ADMIN,
    permissions: Object.values(ADMIN_PERMISSIONS),
  },
  {
    email: 'nurhasanmasum@gmail.com',
    passwordHash: 'Admin@12345',
    firstName: 'Masum',
    lastName: 'Nur Hasan',
    role: ADMIN_ROLES.SUPER_ADMIN,
    permissions: Object.values(ADMIN_PERMISSIONS),
  },
];

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'bidsrush' });
  console.log('Connected to MongoDB');

  for (const seed of SEEDS) {
    const existing = await Admin.findOne({ email: seed.email });
    if (existing) {
      console.log(`  Already exists: ${seed.email}`);
      continue;
    }
    await Admin.create(seed);
    console.log(`✓ Created: ${seed.email}  /  ${seed.passwordHash}`);
  }
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
