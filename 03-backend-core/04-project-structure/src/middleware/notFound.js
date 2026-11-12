function notFound(req, res) {
  res.status(404).json({ error: "Nothing here" });
}

module.exports = notFound;
