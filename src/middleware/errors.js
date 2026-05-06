function notFoundHandler(req, res) {
  res.status(404).json({ error: "Not found" });
}

function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  const message = err.publicMessage || err.message || "Internal server error";

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({ error: message });
}

module.exports = { errorHandler, notFoundHandler };
