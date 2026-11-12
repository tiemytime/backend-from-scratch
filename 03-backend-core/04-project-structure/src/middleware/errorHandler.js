function errorHandler(err, req, res, next) {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Bad JSON" });
  }
  console.log(err);
  res.status(500).json({ error: "Something broke on our side" });
}

module.exports = errorHandler;
