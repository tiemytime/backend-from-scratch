// The kitchen: the real work and the data.
// Knows nothing about HTTP: no req, no res, no status codes.
let notes = [{ id: 1, text: "Buy milk", pinned: false }];

function listNotes(search) {
  if (!search) {
    return notes;
  }
  const word = search.toLowerCase();
  return notes.filter((n) => n.text.toLowerCase().includes(word));
}

function getNote(id) {
  return notes.find((n) => n.id === id);
}

function createNote(data) {
  const nextId = Math.max(0, ...notes.map((n) => n.id)) + 1;
  const note = { id: nextId, ...data };
  notes.push(note);
  return note;
}

function updateNote(id, changes) {
  const note = getNote(id);
  if (!note) {
    return null;
  }
  Object.assign(note, changes);
  return note;
}

function deleteNote(id) {
  const before = notes.length;
  notes = notes.filter((n) => n.id !== id);
  return notes.length < before;
}

module.exports = { listNotes, getNote, createNote, updateNote, deleteNote };
