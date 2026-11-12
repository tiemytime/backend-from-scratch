// Middleware example. Run: node example.js
const express = require("express");
const crypto = require("crypto");

const app = express();
const notes = [{ id: 1, text: "Buy milk" }];

// ---------- Global middleware: runs for EVERY request ----------

// Give each request an id, so its log lines can be found later
app.use((req, res, next) => {
  req.id = crypto.randomUUID().slice(0, 8);
  res.setHeader("X-Request-Id", req.id);
  next();
});

// Logger: method, path, status, time taken
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(req.id, req.method, req.originalUrl, res.statusCode, ms + "ms");
  });
  next();
});

// Body parser: JSON text -> req.body
app.use(express.json());

// ---------- Path middleware: runs only for paths starting with /admin ----------

app.use("/admin", (req, res, next) => {
  if (req.get("X-Admin-Key") !== "letmein") {
    return res.status(401).json({ error: "Admin key missing or wrong" });
  }
  next();
});

// ---------- Route middleware: runs only on the routes you put it on ----------

function requireJson(req, res, next) {
  if (!req.is("application/json")) {
    return res.status(415).json({ error: "Send JSON with Content-Type: application/json" });
  }
  next();
}

// ---------- Routes ----------

app.get("/api/notes", (req, res) => {
  res.json(notes);
});

app.post("/api/notes", requireJson, (req, res) => {
  const note = { id: notes.length + 1, text: req.body.text };
  notes.push(note);
  res.status(201).json(note);
});

app.get("/admin/stats", (req, res) => {
  res.json({ notes: notes.length });
});

// A bug on purpose, to see the error handler catch it
app.get("/boom", (req, res) => {
  throw new Error("something exploded");
});

// Same, but inside async code. Express 5 catches this too.
app.get("/boom-async", async (req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  throw new Error("async thing exploded");
});

// ---------- After all routes ----------

// Nothing matched -> 404
app.use((req, res) => {
  res.status(404).json({ error: "Nothing here" });
});

// Error handler: 4 arguments. Anything that throws lands here.
app.use((err, req, res, next) => {
  console.log(req.id, "ERROR:", err.message);
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Bad JSON" });
  }
  res.status(500).json({ error: "Something broke on our side", requestId: req.id });
});

app.listen(3000, () => {
  console.log("Listening on port 3000");
});
