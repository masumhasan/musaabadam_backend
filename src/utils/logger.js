const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.info;

const formatMessage = (level, message, meta) => {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] ${message}`;
  return meta ? `${base} ${JSON.stringify(meta)}` : base;
};

const logger = {
  error: (message, meta) => {
    if (currentLevel >= LOG_LEVELS.error) console.error(formatMessage('error', message, meta));
  },
  warn: (message, meta) => {
    if (currentLevel >= LOG_LEVELS.warn) console.warn(formatMessage('warn', message, meta));
  },
  info: (message, meta) => {
    if (currentLevel >= LOG_LEVELS.info) console.log(formatMessage('info', message, meta));
  },
  debug: (message, meta) => {
    if (currentLevel >= LOG_LEVELS.debug) console.log(formatMessage('debug', message, meta));
  },
};

module.exports = logger;
