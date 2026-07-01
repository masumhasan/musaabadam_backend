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
