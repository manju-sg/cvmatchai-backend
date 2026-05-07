require("dotenv").config();

const { createApp } = require("./src/app");
const { initPostgres } = require("./src/services/postgres");
const { closeQueue } = require("./src/services/queue");
const { logger } = require("./src/utils/logger");
const { config } = require("./src/config");

async function boot() {
  await initPostgres();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`CVMatch backend running on http://localhost:${config.port}`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);

    server.close(async () => {
      await closeQueue();
      logger.info("HTTP server closed.");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

boot().catch((error) => {
  logger.error(`Startup failed: ${error.message}`);
  process.exit(1);
});
