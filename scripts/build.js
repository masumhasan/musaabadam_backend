const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('🧹 Cleaning old build...');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

console.log('📁 Creating build directories...');
fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(path.join(distDir, 'src'), { recursive: true });

console.log('📦 Copying source files...');
copyRecursiveSync(path.join(rootDir, 'src'), path.join(distDir, 'src'));

console.log('📄 Copying package files and configs...');
fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(distDir, 'package.json'));
if (fs.existsSync(path.join(rootDir, 'package-lock.json'))) {
  fs.copyFileSync(path.join(rootDir, 'package-lock.json'), path.join(distDir, 'package-lock.json'));
}
if (fs.existsSync(path.join(rootDir, '.env'))) {
  // If .env exists, copy as .env.example or template to avoid copying sensitive local secrets directly,
  // but let's copy a generic env template so they can fill it on EC2.
  fs.copyFileSync(path.join(rootDir, '.env'), path.join(distDir, '.env.example'));
}

console.log('⚙️ Generating production PM2 ecosystem config...');
const ecosystemConfig = `module.exports = {
  apps: [
    {
      name: 'bidsrush-backend',
      script: 'src/server.js',
      instances: 1, // Running 1 instance to prevent race conditions with Socket.io/in-memory cron sweeper
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      }
    }
  ]
};
`;

fs.writeFileSync(path.join(distDir, 'ecosystem.config.js'), ecosystemConfig);

console.log('✅ Build completed successfully in dist/');
