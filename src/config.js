const path = require("path");

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseOrigins = (value) => {
  if (!value) return ["*"];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const config = {
  port: toInt(process.env.PORT, 3000),
  appEnv: process.env.NODE_ENV || "development",
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
  dataDir: process.env.DATA_DIR || path.join(process.cwd(), "data"),
  uploadDir: process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"),
  maxFilesPerJob: toInt(process.env.MAX_FILES_PER_JOB, 250),
  maxFileSizeBytes: toInt(process.env.MAX_FILE_SIZE_MB, 10) * 1024 * 1024,
  maxConcurrentJobs: toInt(process.env.MAX_CONCURRENT_JOBS, 3),
  pollIntervalMs: toInt(process.env.POLL_INTERVAL_MS, 1500),
  queueRetentionHours: toInt(process.env.QUEUE_RETENTION_HOURS, 24),
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
};

module.exports = { config };
