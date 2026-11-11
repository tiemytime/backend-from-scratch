# Step 8: One specific note (CRUD)

[← Step 7](../step-07-http-module/) · [All steps](../) · [Step 9 →](../step-09-search/)

## In plain words: Work with one specific note

Before, customers could only say "show me **all** notes" or "add a note". Now they can point at **one** note by its number, using the address:

| Address | Plain words |
|---|---|
| `GET /api/notes/3` | "Show me note 3" |
| `PUT /api/notes/3` | "Change note 3 to this" |
| `DELETE /api/notes/3` | "Throw away note 3" |

Show, add, change, delete together are called **CRUD**. Almost every app in the world is CRUD with extra steps.

**How the server finds note 3:**
1. Cut the address at every `/`: `""`, `"api"`, `"notes"`, `"3"`. Take piece number 3 (counting starts at 0).
2. Walk along the shelf and stop at the first note numbered 3 (`find`).
3. No such note? Say **"we don't have that" (404)**.

**How delete works:** we don't tear a page out. We copy every note **except** that one onto a fresh list (`filter`), and keep the fresh list.

**The ticket-number bug.** New notes got the number "how many notes there are, plus 1". Then:

- Notes 1 and 2 exist. Delete note 1. Now there's **one** note, numbered 2.
- Add a new note: "one note, plus 1" = **2**. That number is already taken.

Like a queue where tickets are numbered by "people in line + 1": someone leaves, and the next person gets a number already in someone's hand.

**The fix:** look at the **biggest** number on the shelf and add 1. Deleting can never make the biggest number go back to one that's in use. On an empty shelf, start from 0, so the first note gets 1.

## Run it

```bash
cd 02-http/build-a-server/step-08-crud
node server.js
```

Full code: [`server.js`](./server.js)

## How it works

| Request | In plain words | Reply |
|---|---|---|
| `GET /api/notes/2` | Show me note 2 | 200 + the note |
| `PUT /api/notes/2` | Change note 2 to this | 200 + updated note |
| `DELETE /api/notes/2` | Throw away note 2 | 204 No Content |
| any of these, unknown id | | 404 |
| `PATCH /api/notes/2` | (not handled) | 405 Method Not Allowed |

Create, Read, Update, Delete = **CRUD**. Most apps are CRUD with extra steps.

```js
} else if (req.url.startsWith("/api/notes/")) {
  const id = Number(req.url.split("/")[3]);
  const note = notes.find((n) => n.id === id);

  if (!note) {
    sendJson(res, 404, { error: "No such note" });
  } else if (req.method === "GET") {
    sendJson(res, 200, note);
  } else if (req.method === "PUT") {
    readBody(req, (requestBody) => {
      // JSON.parse, note.text = input.text, saveNotes(), sendJson 200
    });
  } else if (req.method === "DELETE") {
    notes = notes.filter((n) => n.id !== id);
    saveNotes();
    send(res, 204, "text/plain", "");
  }
}
```

**Reading the id from the path:**

```
"/api/notes/7".split("/")
→  [ "",   "api",   "notes",   "7" ]
     0      1        2          3
```
`split` cuts at the slashes and throws them away. Piece 0 is empty because the path starts with `/`. `Number("7")` → `7`.

**Three list tools:**

| Tool | Goes through | Gives back |
|---|---|---|
| `find` | one at a time, **stops at first match** | one item (or `undefined`) |
| `filter` | **every** item | a new list of items where the question is **true** |
| `map` | **every** item | a new list, each item **turned into** something else |

`filter` **keeps** what's true. To delete note 1, ask "is this **not** note 1?" (`n.id !== id`). Asking `n.id === id` keeps only note 1 and deletes everything else. No crash, just wrong.

**Helpers:** `sendJson(res, status, data)` = send as JSON in one line. `readBody(req, callback)` = collect the body, then run `callback` with it. A **callback** is an instruction left for later: "when the parcel arrives, do this".

`let notes` instead of `const`: DELETE points `notes` at a brand new list.

**The duplicate-id bug:**

```js
id: notes.length + 1      // count + 1
```
Notes 1, 2 → delete 1 → one note left (id 2) → next id = 1 + 1 = **2 again**. Then `find` only ever sees the first id 2, and `filter` deletes both.

Fix: biggest id + 1, with a floor of 0 for the empty list.

```js
const nextId = Math.max(0, ...notes.map((n) => n.id)) + 1;
```
Without the `0`: `Math.max()` of nothing is `-Infinity`, and JSON saves that as `null`. **Always test the empty case.**

### Lessons from mistakes along the way
- JS is **case-sensitive**: `saveNOtes`, `REs` → `ReferenceError: ... is not defined`. Check spelling first.
- Typo'd a variable name (`notr` vs `note`) → crash inside `try` → `catch` replied "Bad JSON" even though the JSON was fine. **`catch` catches every crash, not just the one you expect.** Always `console.log(err)` in `catch` so the real reason shows.
- Use `===` / `!==`, not `==`. `"7" == 7` is true (loose), `"7" === 7` is false (exact).
- Deleting `notes.json` while the server runs doesn't clear its memory. Restart it.

---

[← Step 7](../step-07-http-module/) · [All steps](../) · [Step 9 →](../step-09-search/)
