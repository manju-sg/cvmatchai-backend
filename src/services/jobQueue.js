const { config } = require("../config");

class JobQueue {
  constructor(concurrency) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
    this.closed = false;
  }

  enqueue(task) {
    if (this.closed) {
      throw new Error("Queue is closed");
    }

    this.queue.push(task);
    this.pump();
  }

  pump() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      this.running += 1;

      Promise.resolve()
        .then(task)
        .catch((error) => {
          console.error("Queue task failed:", error);
        })
        .finally(() => {
          this.running -= 1;
          this.pump();
        });
    }
  }

  async close() {
    this.closed = true;
  }
}

const jobQueue = new JobQueue(config.maxConcurrentJobs);

module.exports = { jobQueue };
