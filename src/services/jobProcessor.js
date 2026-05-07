const fs = require("fs/promises");

const { getJob, updateJob } = require("./jobStore");
const { parseFile } = require("./parser");
const { scoreCandidates } = require("./scoring");

async function processJob(jobId) {
  const job = await getJob(jobId);
  if (!job) return;

  job.status = "processing";
  job.progress = 5;
  job.updatedAt = new Date().toISOString();
  await updateJob(job);

  try {
    const parsedCandidates = [];

    for (let index = 0; index < job.files.length; index += 1) {
      const file = job.files[index];
      const text = await parseFile({
        originalname: file.fileName,
        mimetype: file.mimeType,
        path: file.filePath,
      });

      parsedCandidates.push({
        fileName: file.fileName,
        text,
      });

      job.progress = Math.min(65, Math.round(((index + 1) / job.files.length) * 60));
      job.updatedAt = new Date().toISOString();
      await updateJob(job);
    }

    const scored = await scoreCandidates(job.jdContent, parsedCandidates, job.modelPreference);

    job.status = "completed";
    job.progress = 100;
    job.results = scored.results;
    job.comparativeSummary = scored.comparativeSummary;
    job.files = job.files.map((file) => ({
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
    }));
    job.updatedAt = new Date().toISOString();
    await updateJob(job);
  } catch (error) {
    job.status = "failed";
    job.error = error.message;
    job.updatedAt = new Date().toISOString();
    await updateJob(job);
    throw error;
  } finally {
    await Promise.allSettled(
      (job.files || [])
        .filter((file) => file.filePath)
        .map((file) => fs.unlink(file.filePath))
    );
  }
}

module.exports = { processJob };
