require("dotenv").config();

const { createApp } = require("./src/app");
const { jobQueue } = require("./src/services/jobQueue");
const { logger } = require("./src/utils/logger");
const { config } = require("./src/config");

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(`CVMatch backend running on http://localhost:${config.port}`);
});

const shutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully...`);

  server.close(async () => {
    await jobQueue.close();
    logger.info("HTTP server closed.");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
