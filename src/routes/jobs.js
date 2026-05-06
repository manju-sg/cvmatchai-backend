const express = require("express");
const multer = require("multer");

const { config } = require("../config");
const { createMatchJob, getJobSummary, getJobResult } = require("../services/jobService");

const jobsRouter = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
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

module.exports = { jobsRouter };
