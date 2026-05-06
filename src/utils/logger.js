const logger = {
  info: (message) => console.log(`[info] ${message}`),
  warn: (message) => console.warn(`[warn] ${message}`),
  error: (message) => console.error(`[error] ${message}`),
};

module.exports = { logger };
