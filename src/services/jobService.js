const crypto = require("crypto");

const { enqueueJob, getQueueStats } = require("./queue");
const { createJob, getJob, updateJob } = require("./jobStore");

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

async function sanitizeJob(job) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    jdTitle: job.jdTitle,
    fileCount: job.fileCount,
    queue: await getQueueStats(),
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
      filePath: file.path,
      fileSize: file.size,
    })),
    results: [],
    comparativeSummary: "",
  };

  await createJob(job);
  await enqueueJob(job.id);

  return {
    jobId: job.id,
    status: job.status,
    pollUrl: `/api/jobs/${job.id}`,
    resultUrl: `/api/jobs/${job.id}/results`,
  };
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
    ...(await sanitizeJob(job)),
    results: job.results || [],
    comparativeSummary: job.comparativeSummary || "",
  };
}

async function markJobFailed(jobId, errorMessage) {
  const job = await getJob(jobId);
  if (!job) return;
  job.status = "failed";
  job.error = errorMessage;
  job.updatedAt = new Date().toISOString();
  await updateJob(job);
}

module.exports = { createMatchJob, getJobSummary, getJobResult, markJobFailed };
