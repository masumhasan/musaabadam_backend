require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/database');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await connectDB();

  const server = http.createServer(app);

  const { initSocket } = require('./socket');
  initSocket(server);

  // Background job: auto-expire flash sales whose window has passed.
  const productService = require('./modules/products/services/product.service');
  const flashSaleJob = setInterval(() => {
    productService.expireFlashSales().catch((err) => logger.error('Flash sale sweep failed', { error: err.message }));
  }, 60 * 1000);
  if (flashSaleJob.unref) flashSaleJob.unref();

  // Background job: send pre-show reminders for scheduled streams starting in 15 mins.
  const streamService = require('./modules/streams/services/stream.service');
  const reminderJob = setInterval(() => {
    streamService.sendPreShowReminders().catch((err) => logger.error('Pre-show reminder sweep failed', { error: err.message }));
  }, 60 * 1000);
  if (reminderJob.unref) reminderJob.unref();

  // Background job: auto-release escrow for delivered orders after 3 days.
  const orderService = require('./modules/orders/services/order.service');
  const escrowJob = setInterval(() => {
    orderService.autoReleaseEscrow().catch((err) => logger.error('Escrow sweep failed', { error: err.message }));
  }, 60 * 1000);
  if (escrowJob.unref) escrowJob.unref();

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use. Change PORT in .env or kill the blocking process.`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(PORT, () => {
    logger.info(`BidsRush API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });

  const gracefulShutdown = (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection', { reason });
    server.close(() => process.exit(1));
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message });
    process.exit(1);
  });
};

startServer();
