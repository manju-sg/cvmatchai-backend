const express = require("express");
const multer = require("multer");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const { config } = require("../config");
const { createMatchJob, getJobSummary, getJobResult } = require("../services/jobService");

const jobsRouter = express.Router();

const tempUploadDir = path.join(config.uploadDir, "incoming");
fs.mkdir(tempUploadDir, { recursive: true }).catch(() => {});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, tempUploadDir),
    filename: (req, file, cb) => {
      const safeName = `${Date.now()}-${crypto.randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      cb(null, safeName);
    },
  }),
  limits: {
    fileSize: config.maxFileSizeBytes,
    files: config.maxFilesPerJob,
  },
});

jobsRouter.post("/submit", upload.array("cvs", config.maxFilesPerJob), async (req, res, next) => {
  try {
    const { jdTitle = "", jdContent = "", modelPreference = "" } = req.body;
    const files = req.files || [];

    const job = await createMatchJob({
      jdTitle,
      jdContent,
      modelPreference,
      files,
    });

    res.status(202).json(job);
  } catch (error) {
    next(error);
  }
});

jobsRouter.get("/:jobId", async (req, res, next) => {
  try {
    const summary = await getJobSummary(req.params.jobId);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

jobsRouter.get("/:jobId/results", async (req, res, next) => {
  try {
    const result = await getJobResult(req.params.jobId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

jobsRouter.get("/:jobId/events", async (req, res, next) => {
  try {
    const { jobId } = req.params;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let closed = false;
    req.on("close", () => {
      closed = true;
    });

    const send = async () => {
      const summary = await getJobSummary(jobId);
      res.write(`event: progress\n`);
      res.write(`data: ${JSON.stringify(summary)}\n\n`);

      if (summary.status === "completed" || summary.status === "failed") {
        res.write(`event: done\n`);
        res.write(`data: ${JSON.stringify(summary)}\n\n`);
        res.end();
        closed = true;
      }
    };

    await send();

    const interval = setInterval(async () => {
      if (closed) {
        clearInterval(interval);
        return;
      }

      try {
        await send();
      } catch (error) {
        clearInterval(interval);
        if (!closed) {
          res.write(`event: error\n`);
          res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
          res.end();
        }
      }
    }, config.ssePollIntervalMs);
  } catch (error) {
    next(error);
  }
});

module.exports = { jobsRouter };
