const express = require("express");
const { getQueueStats } = require("../services/queue");

const healthRouter = express.Router();

healthRouter.get("/", async (req, res) => {
  res.json({
    ok: true,
    service: "cvmatch-backend",
    timestamp: new Date().toISOString(),
    queue: await getQueueStats(),
  });
});

module.exports = { healthRouter };
