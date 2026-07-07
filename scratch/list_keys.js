const fs = require('fs');
const dotenv = require('dotenv');

try {
  const envConfig = dotenv.parse(fs.readFileSync('.env'));
  console.log('Env Keys found:');
  for (const k of Object.keys(envConfig)) {
    console.log(`- ${k}`);
  }
} catch (e) {
  console.error(e);
}
