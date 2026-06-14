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
  if (!origin) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin);
};

const resolveOrigin = (origin, callback) => {
  if (process.env.NODE_ENV !== 'production') {
    return callback(null, isDevOrigin(origin));
  }
  const allowed = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
  callback(null, allowed.includes(origin));
};

const corsOptions = {
  origin: resolveOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

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

// ─── 404 & Error Handling ─────────────────────────────────────────────────────

app.use(notFound);
app.use(errorHandler);

module.exports = app;
