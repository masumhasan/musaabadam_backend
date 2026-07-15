const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { errorHandler } = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const logger = require('./utils/logger');

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────

app.use(helmet());

const isDevOrigin = (origin) => {
  return true;
};

const resolveOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (process.env.NODE_ENV !== 'production') {
    return callback(null, isDevOrigin(origin));
  }
  const allowed = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
  if (allowed.includes('*')) return callback(null, true);
  callback(null, allowed.includes(origin));
};

const corsOptions = {
  origin: resolveOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// ─── Webhooks ─────────────────────────────────────────────────────────────────
// Mounted BEFORE the rate limiter (server-to-server traffic shouldn't be
// throttled against the user-facing limit) and BEFORE the JSON body parser so
// the raw payload is preserved for signature verification. GetStream posts
// recording lifecycle events here.

const streamController = require('./modules/streams/controllers/stream.controller');
app.post(
  '/api/v1/streams/webhooks/getstream',
  express.raw({ type: '*/*', limit: '5mb' }),
  streamController.getStreamWebhook
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
});
app.use('/api/', globalLimiter);

// ─── Parsing ──────────────────────────────────────────────────────────────────

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Logging ──────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'test') {
  app.use(
    morgan('combined', {
      stream: { write: (message) => logger.info(message.trim()) },
    })
  );
}

// ─── Static files (temp — replace with S3 later) ─────────────────────────────

app.use('/uploads', express.static('uploads'));

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ success: true, message: 'BidsRush API is running', timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/v1/auth', require('./modules/auth/routes/auth.routes'));
app.use('/api/v1/users', require('./modules/users/routes/user.routes'));
app.use('/api/v1/products', require('./modules/products/routes/product.routes'));
app.use('/api/v1/categories', require('./modules/products/routes/category.routes'));
app.use('/api/v1/settings', require('./modules/settings/routes/settings.routes'));
app.use('/api/v1/admin', require('./modules/admin/routes/admin.routes'));
app.use('/api/v1/streams', require('./modules/streams/routes/stream.routes'));
app.use('/api/v1/uploads', require('./modules/uploads/routes/upload.routes'));
app.use('/api/v1/orders', require('./modules/orders/routes/order.routes'));
app.use('/api/v1/auctions', require('./modules/auctions/routes/auction.routes'));
app.use('/api/v1/payments', require('./modules/payments/routes/payment.routes'));
app.use('/api/v1/chat', require('./modules/chat/routes/chat.routes'));
app.use('/api/v1/shipping', require('./modules/shipping/routes/shipping.routes'));
app.use('/api/v1/search', require('./modules/search/routes/search.routes'));
app.use('/api/v1/notifications', require('./modules/notifications/routes/notification.routes'));
app.use('/api/v1/reviews', require('./modules/reviews/routes/review.routes'));
app.use('/api/v1/giveaways', require('./modules/giveaways/routes/giveaway.routes'));
app.use('/api/v1/reports', require('./modules/reports/routes/report.routes'));
app.use('/api/v1/favorites', require('./modules/favorites/routes/favorite.routes'));
app.use('/api/v1/offers', require('./modules/offers/routes/offer.routes'));
app.use('/api/v1/analytics', require('./modules/analytics/routes/analytics.routes'));
app.use('/api/v1/dms', require('./modules/dms/routes/dm.routes'));

// ─── 404 & Error Handling ─────────────────────────────────────────────────────

app.use(notFound);
app.use(errorHandler);

module.exports = app;
