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
  jobsDir: process.env.JOBS_DIR || path.join(process.cwd(), "data", "jobs"),
  maxFilesPerJob: toInt(process.env.MAX_FILES_PER_JOB, 250),
  maxFileSizeBytes: toInt(process.env.MAX_FILE_SIZE_MB, 10) * 1024 * 1024,
  workerConcurrency: toInt(process.env.WORKER_CONCURRENCY, 3),
  maxQueuedJobs: toInt(process.env.MAX_QUEUED_JOBS, 500),
  pollIntervalMs: toInt(process.env.POLL_INTERVAL_MS, 1500),
  queueRetentionHours: toInt(process.env.QUEUE_RETENTION_HOURS, 24),
  ssePollIntervalMs: toInt(process.env.SSE_POLL_INTERVAL_MS, 1000),
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  databaseUrl: process.env.DATABASE_URL || "",
  redisUrl: process.env.REDIS_URL || "",
  runWorker: (process.env.RUN_JOB_WORKER || "true").toLowerCase() === "true",
};

module.exports = { config };
