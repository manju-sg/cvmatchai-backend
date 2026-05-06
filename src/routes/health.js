const express = require("express");

const healthRouter = express.Router();

healthRouter.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "cvmatch-backend",
    timestamp: new Date().toISOString(),
  });
});

module.exports = { healthRouter };
