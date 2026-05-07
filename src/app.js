const express = require("express");
const cors = require("cors");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const { config } = require("./config");
const { errorHandler, notFoundHandler } = require("./middleware/errors");
const { requestLogger } = require("./middleware/requestLogger");
const { healthRouter } = require("./routes/health");
const { jobsRouter } = require("./routes/jobs");

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes("*") || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin not allowed by CORS"));
      },
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(requestLogger);
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 240,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.use("/health", healthRouter);
  app.use("/api/jobs", jobsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
