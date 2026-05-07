require("dotenv").config();

const { initPostgres } = require("./src/services/postgres");
const { startWorker, closeQueue } = require("./src/services/queue");
const { processJob } = require("./src/services/jobProcessor");
const { markJobFailed } = require("./src/services/jobService");
const { logger } = require("./src/utils/logger");

async function boot() {
  await initPostgres();

  await startWorker(async (jobId) => {
    try {
      await processJob(jobId);
    } catch (error) {
      await markJobFailed(jobId, error.message);
      throw error;
    }
  });

  logger.info("CVMatch worker started.");

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down worker gracefully...`);
    await closeQueue();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

boot().catch((error) => {
  logger.error(`Worker startup failed: ${error.message}`);
  process.exit(1);
});
