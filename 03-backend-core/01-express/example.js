const express = require("express");
const fs = require("fs");

const FILE = __dirname + "/notes.json";

function loadNotes() {
  if (!fs.existsSync(FILE)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function saveNotes() {
  fs.writeFileSync(FILE, JSON.stringify(notes, null, 2));
}

let notes = loadNotes();
console.log("Loaded", notes.length, "notes from disk");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Home page\n");
});

app.get("/about", (req, res) => {
  res.send("About: this server is built with Express\n");
});

app.get("/api/notes", (req, res) => {
  const search = req.query.search;
  if (!search) {
    res.json(notes);
  } else {
    const word = search.toLowerCase();
    const matches = notes.filter((n) => n.text.toLowerCase().includes(word));
    res.json(matches);
  }
});

app.post("/api/notes", (req, res) => {
  const nextId = Math.max(0, ...notes.map((n) => n.id)) + 1;
  const note = { id: nextId, text: req.body.text };
  notes.push(note);
  saveNotes();
  res.status(201).json(note);
});

app.get("/api/notes/:id", (req, res) => {
  const note = notes.find((n) => n.id === Number(req.params.id));
  if (!note) {
    return res.status(404).json({ error: "No such note" });
  }
  res.json(note);
});

app.put("/api/notes/:id", (req, res) => {
  const note = notes.find((n) => n.id === Number(req.params.id));
  if (!note) {
    return res.status(404).json({ error: "No such note" });
  }
  note.text = req.body.text;
  saveNotes();
  res.json(note);
});

app.delete("/api/notes/:id", (req, res) => {
  const id = Number(req.params.id);
  notes = notes.filter((n) => n.id !== id);
  saveNotes();
  res.status(204).end();
});

app.listen(3000, () => {
  console.log("Listening on port 3000");
});
