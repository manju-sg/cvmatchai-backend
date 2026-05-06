const crypto = require("crypto");

const { config } = require("../config");
const { jobQueue } = require("./jobQueue");
const { getJob, upsertJob } = require("./jobStore");
const { parseFile } = require("./parser");
const { scoreCandidates } = require("./scoring");

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.publicMessage = message;
  return error;
}

function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  error.publicMessage = message;
  return error;
}

function sanitizeJob(job) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    jdTitle: job.jdTitle,
    fileCount: job.fileCount,
    error: job.error || null,
  };
}

async function createMatchJob({ jdTitle, jdContent, modelPreference, files }) {
  if (!jdContent || !jdContent.trim()) {
    throw badRequest("Job description content is required.");
  }

  if (!Array.isArray(files) || files.length === 0) {
    throw badRequest("At least one CV file is required.");
  }

  if (files.length > config.maxFilesPerJob) {
    throw badRequest(`Maximum ${config.maxFilesPerJob} CVs are allowed per job.`);
  }

  const job = {
    id: crypto.randomUUID(),
    status: "queued",
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jdTitle: jdTitle || "Untitled role",
    jdContent,
    modelPreference: modelPreference || "balanced",
    fileCount: files.length,
    files: files.map((file) => ({
      fileName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer.toString("base64"),
    })),
    results: [],
    comparativeSummary: "",
  };

  await upsertJob(job);

  jobQueue.enqueue(() => processJob(job.id));

  return {
    jobId: job.id,
    status: job.status,
    pollUrl: `/api/jobs/${job.id}`,
    resultUrl: `/api/jobs/${job.id}/results`,
  };
}

async function processJob(jobId) {
  const job = await getJob(jobId);
  if (!job) return;

  job.status = "processing";
  job.progress = 5;
  job.updatedAt = new Date().toISOString();
  await upsertJob(job);

  try {
    const parsedCandidates = [];

    for (let index = 0; index < job.files.length; index += 1) {
      const file = job.files[index];
      const text = await parseFile({
        originalname: file.fileName,
        mimetype: file.mimeType,
        buffer: Buffer.from(file.buffer, "base64"),
      });

      parsedCandidates.push({
        fileName: file.fileName,
        text,
      });

      job.progress = Math.min(65, Math.round(((index + 1) / job.files.length) * 60));
      job.updatedAt = new Date().toISOString();
      await upsertJob(job);
    }

    const scored = await scoreCandidates(job.jdContent, parsedCandidates, job.modelPreference);

    job.status = "completed";
    job.progress = 100;
    job.results = scored.results;
    job.comparativeSummary = scored.comparativeSummary;
    job.files = job.files.map((file) => ({ fileName: file.fileName, mimeType: file.mimeType }));
    job.updatedAt = new Date().toISOString();
    await upsertJob(job);
  } catch (error) {
    job.status = "failed";
    job.error = error.message;
    job.updatedAt = new Date().toISOString();
    await upsertJob(job);
  }
}

async function getJobSummary(jobId) {
  const job = await getJob(jobId);
  if (!job) throw notFound("Job not found.");
  return sanitizeJob(job);
}

async function getJobResult(jobId) {
  const job = await getJob(jobId);
  if (!job) throw notFound("Job not found.");

  return {
    ...sanitizeJob(job),
    results: job.results || [],
    comparativeSummary: job.comparativeSummary || "",
  };
}

module.exports = { createMatchJob, getJobSummary, getJobResult };
