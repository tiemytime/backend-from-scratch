// The waiter: reads the request, asks the service, sends the response.
// No business rules and no data storage here.
const notesService = require("../services/notes.service");

function list(req, res) {
  const notes = notesService.listNotes(req.query.search);
  res.json(notes);
}

function create(req, res) {
  const note = notesService.createNote(req.body);
  res.status(201).json(note);
}

function getOne(req, res) {
  const note = notesService.getNote(req.noteId);
  if (!note) {
    return res.status(404).json({ error: "No such note" });
  }
  res.json(note);
}

function update(req, res) {
  const note = notesService.updateNote(req.noteId, req.body);
  if (!note) {
    return res.status(404).json({ error: "No such note" });
  }
  res.json(note);
}

function remove(req, res) {
  const deleted = notesService.deleteNote(req.noteId);
  if (!deleted) {
    return res.status(404).json({ error: "No such note" });
  }
  res.status(204).end();
}

module.exports = { list, create, getOne, update, remove };
