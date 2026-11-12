// Validation with zod. Run: node example.js
const express = require("express");
const { z } = require("zod");

const app = express();
app.use(express.json());

let notes = [{ id: 1, text: "Buy milk", pinned: false }];

// ---------- Schemas: what correct data looks like ----------

const text = z
  .string({
    error: (issue) => (issue.input === undefined ? "text is required" : "text must be a string"),
  })
  .trim()
  .min(1, { error: "text can't be empty" })
  .max(200, { error: "text must be 200 characters or less" });

const pinned = z.boolean({ error: "pinned must be true or false" });

// Creating: text is required, pinned is optional and defaults to false
const createNoteSchema = z.strictObject({
  text: text,
  pinned: pinned.default(false),
});

// Updating: both optional, no defaults (a default here would overwrite saved values)
const updateNoteSchema = z.strictObject({
  text: text.optional(),
  pinned: pinned.optional(),
});

const idSchema = z.coerce.number().int().positive();

// ---------- Validation middleware ----------

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: result.error.issues.map((issue) => ({
          field: issue.path.join(".") || "(body)",
          message: issue.message,
        })),
      });
    }
    req.body = result.data; // the cleaned version: trimmed, defaults filled in
    next();
  };
}

function validateId(req, res, next) {
  const result = idSchema.safeParse(req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: "id must be a positive whole number" });
  }
  req.noteId = result.data;
  next();
}

// ---------- Routes ----------

app.get("/api/notes", (req, res) => {
  res.json(notes);
});

app.post("/api/notes", validateBody(createNoteSchema), (req, res) => {
  const nextId = Math.max(0, ...notes.map((n) => n.id)) + 1;
  const note = { id: nextId, ...req.body };
  notes.push(note);
  res.status(201).json(note);
});

app.get("/api/notes/:id", validateId, (req, res) => {
  const note = notes.find((n) => n.id === req.noteId);
  if (!note) {
    return res.status(404).json({ error: "No such note" });
  }
  res.json(note);
});

app.patch("/api/notes/:id", validateId, validateBody(updateNoteSchema), (req, res) => {
  const note = notes.find((n) => n.id === req.noteId);
  if (!note) {
    return res.status(404).json({ error: "No such note" });
  }
  Object.assign(note, req.body);
  res.json(note);
});

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Bad JSON" });
  }
  console.log(err);
  res.status(500).json({ error: "Something broke on our side" });
});

app.listen(3000, () => {
  console.log("Listening on port 3000");
});
