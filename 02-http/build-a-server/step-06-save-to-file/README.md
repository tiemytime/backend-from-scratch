# Step 6: Keep data after restart

[← Step 5](../step-05-post/) · [All steps](../) · [Step 7 →](../step-07-http-module/)

## In plain words: A notebook instead of a whiteboard

Our list was written on a whiteboard (memory). Every time the shop closed, someone wiped it.

Now we also copy it into a **notebook on the shelf** (`notes.json`). When the shop opens again, we read the notebook and remember everything.

## Run it

```bash
cd 02-http/build-a-server/step-06-save-to-file
node server.js
```

Full code: [`server.js`](./server.js)

## How it works

Memory (RAM) is a whiteboard: wiped when the server stops. A file is a notebook: it stays.

- **On start:** read `notes.json` to get the notes back.
- **On every new note:** write the whole list to `notes.json` again.

```js
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

const notes = loadNotes();

// in the POST route, after notes.push(note):
saveNotes();
```

| Code | In plain words |
|---|---|
| `require("fs")` | Node's file tool (file system) |
| `__dirname + "/notes.json"` | The file next to server.js, wherever you run it from |
| `fs.existsSync` | "Does the file exist yet?" First run: no, so start with `[]` |
| `fs.readFileSync(FILE, "utf8")` | Read the file as text |
| `fs.writeFileSync` | Replace the whole file with new text |
| `JSON.stringify(notes, null, 2)` | JSON, indented 2 spaces so humans can read it |
| `function name() { }` | A named, reusable block of code |

Test: POST a note, `cat notes.json`, **Ctrl+C and restart the server**, GET again. The note is still there.

`notes.json` is in `.gitignore`: it's data, not code.

**Why this isn't a real database (yet):**
- Every save rewrites the **whole** file. Fine for 10 notes, slow for a million.
- Two requests saving at the same moment can overwrite each other.
- If the server crashes mid-write, the file can be left half-written and broken.
- `id: notes.length + 1` breaks once deleting exists (delete id 1, next note gets a duplicate id).

Databases (SQLite, Postgres) solve exactly these problems.

---

[← Step 5](../step-05-post/) · [All steps](../) · [Step 7 →](../step-07-http-module/)
