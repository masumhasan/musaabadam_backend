module.exports = {
  apps: [
    {
      name: 'bidsrush-backend',
      script: 'dist/src/server.js',
      instances: 1, // Running 1 instance to prevent database/sweeper race conditions
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
