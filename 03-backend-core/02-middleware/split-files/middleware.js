// All our guards live here. This file only DEFINES them, it doesn't run them.
const crypto = require("crypto");

function requestId(req, res, next) {
  req.id = crypto.randomUUID().slice(0, 8);
  next();
}

function logger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    console.log(req.id, req.method, req.originalUrl, res.statusCode, Date.now() - start + "ms");
  });
  next();
}

function requireAdmin(req, res, next) {
  if (req.get("X-Admin-Key") !== "letmein") {
    return res.status(401).json({ error: "Admin key missing or wrong" });
  }
  next();
}

function notFound(req, res) {
  res.status(404).json({ error: "Nothing here" });
}

function errorHandler(err, req, res, next) {
  console.log(req.id, "ERROR:", err.message);
  res.status(500).json({ error: "Something broke on our side", requestId: req.id });
}

module.exports = { requestId, logger, requireAdmin, notFound, errorHandler };
