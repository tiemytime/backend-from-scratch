// Run: node --env-file=.env server.js
const express = require("express");
const config = require("./config");

const app = express();

app.use("/admin", (req, res, next) => {
  if (req.get("X-Admin-Key") !== config.adminKey) {
    return res.status(401).json({ error: "Admin key missing or wrong" });
  }
  next();
});

app.get("/admin/stats", (req, res) => {
  res.json({ env: config.env, notes: 1 });
});

app.listen(config.port, () => {
  console.log("Listening on port " + config.port + " (" + config.env + ")");
});
