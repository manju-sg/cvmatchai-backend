const fs = require("fs/promises");
const path = require("path");

const { config } = require("../config");

const jobsFile = path.join(config.dataDir, "jobs.json");

async function ensureStore() {
  await fs.mkdir(config.dataDir, { recursive: true });

  try {
    await fs.access(jobsFile);
  } catch {
    await fs.writeFile(jobsFile, JSON.stringify({ jobs: {} }, null, 2), "utf8");
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(jobsFile, "utf8");
  return JSON.parse(raw);
}

async function writeStore(store) {
  await ensureStore();
  await fs.writeFile(jobsFile, JSON.stringify(store, null, 2), "utf8");
}

async function upsertJob(job) {
  const store = await readStore();
  store.jobs[job.id] = job;
  await writeStore(store);
  return job;
}

async function getJob(jobId) {
  const store = await readStore();
  return store.jobs[jobId] || null;
}

module.exports = { upsertJob, getJob };
