const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");

const { config } = require("../config");
const { logger } = require("../utils/logger");

if (!config.redisUrl) {
  throw new Error("REDIS_URL is required for BullMQ.");
}

const connection = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const queueName = "cvmatch-jobs";
const jobQueue = new Queue(queueName, {
  connection,
  defaultJobOptions: {
    removeOnComplete: 500,
    removeOnFail: 1000,
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
  },
});

let worker;

async function enqueueJob(jobId) {
  const counts = await jobQueue.getJobCounts("waiting", "delayed", "prioritized");
  const queued = (counts.waiting || 0) + (counts.delayed || 0) + (counts.prioritized || 0);

  if (queued >= config.maxQueuedJobs) {
    const error = new Error("Server is busy. Please retry shortly.");
    error.statusCode = 503;
    error.publicMessage = "Server is busy. Please retry shortly.";
    throw error;
  }

  await jobQueue.add("process-match-job", { jobId }, { jobId });
}

async function startWorker(processor) {
  if (!config.runWorker || worker) return;

  worker = new Worker(
    queueName,
    async (bullJob) => processor(bullJob.data.jobId),
    {
      connection,
      concurrency: config.workerConcurrency,
    }
  );

  worker.on("completed", (job) => {
    logger.info(`Worker completed job ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    logger.error(`Worker failed job ${job?.id}: ${error.message}`);
  });
}

async function getQueueStats() {
  const counts = await jobQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed", "prioritized");
  return {
    waiting: counts.waiting || 0,
    active: counts.active || 0,
    completed: counts.completed || 0,
    failed: counts.failed || 0,
    delayed: counts.delayed || 0,
    prioritized: counts.prioritized || 0,
    concurrency: config.workerConcurrency,
    workerEnabled: config.runWorker,
  };
}

async function closeQueue() {
  if (worker) {
    await worker.close();
  }

  await jobQueue.close();
  await connection.quit();
}

module.exports = { enqueueJob, startWorker, getQueueStats, closeQueue };
