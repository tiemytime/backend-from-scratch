# Step 7: Use Node's `http` module

[← Step 6](../step-06-save-to-file/) · [All steps](../) · [Step 8 →](../step-08-crud/)

## In plain words: Hire an assistant

So far we did all the boring work by hand: cutting the request into pieces, finding the blank line, writing every label ourselves.

Node has a built-in assistant, the `http` module, that does that cutting for us.

- **Old way (`net`, [Step 6](../step-06-save-to-file/server.js)):** the customer hands us **one long scrap of paper** with everything scribbled on it. We cut it up ourselves to find what they want.
- **New way (`http`, [this step](./server.js)):** the assistant takes the scrap, cuts it up, and hands us **a neat filled-in form** (`req`) plus **a blank reply form** (`res`). We read the boxes and fill in our answer.

Below, each job the server does, old code next to new code.

### Job 1: Open the shop

Old:
```js
const net = require("net");
const server = net.createServer((socket) => {
  socket.on("data", (data) => {
    // raw data arrives here
  });
});
```

New:
```js
const http = require("http");
const server = http.createServer((req, res) => {
  // req and res are ready here
});
```

- Old: we get `socket`, a raw phone line, and wait for `data` to come down it.
- New: we get **two things straight away**:
  - `req` (request): the neat form with the customer's question
  - `res` (response): the blank form we fill in to answer

### Job 2: What do they want? (method and path)

Old: we cut the scrap of paper ourselves.
```js
const request = data.toString();                        // bytes → text
const [head, requestBody] = request.split("\r\n\r\n");  // cut at the blank line
const firstLine = head.split("\r\n")[0];                // keep the first line
const [method, path] = firstLine.split(" ");            // cut at the spaces
```
Four lines of cutting to turn `GET /api/notes HTTP/1.1` into a method and a path.

New: the boxes are already filled in.
```js
req.method   // "GET"
req.url      // "/api/notes"
```

That's why the old check says `path === "/about"` and the new one says `req.url === "/about"`. Same check, different name for the box.

### Job 3: Read what they handed us (the body)

Old: the body was the part after the blank line, already cut off in Job 2.
```js
const input = JSON.parse(requestBody);
```

New:
```js
let requestBody = "";
req.on("data", (chunk) => {
  requestBody += chunk;
});
req.on("end", () => {
  const input = JSON.parse(requestBody);
  // ...add the note, reply
});
```

**Why is the new one longer? Because it's more correct.**

Think of a long letter arriving **page by page** in the post:

- `let requestBody = ""`: get an empty folder ready
- `req.on("data", ...)`: **each time a page arrives**, put it in the folder (`+=` means "add to the end")
- `req.on("end", ...)`: **when the last page has arrived**, open the folder and read the whole letter

The old code assumed the whole letter always comes in one envelope. True for tiny notes, but a big upload arrives in pieces, and the old server would read only page 1 and break.

### Job 4: Answer them

Old: every line written by hand, `\r\n` included.
```js
socket.write("HTTP/1.1 " + status + "\r\n");
socket.write("Content-Type: " + contentType + "\r\n");
socket.write("Content-Length: " + Buffer.byteLength(body) + "\r\n");
socket.write("\r\n");
socket.write(body);
socket.end();
```

New:
```js
res.writeHead(201, {
  "Content-Type": "application/json",
  "Content-Length": Buffer.byteLength(body),
});
res.end(body);
```

| Old (by hand) | New |
|---|---|
| `"HTTP/1.1 " + status + "\r\n"` | the `201` in `writeHead(201, ...)` |
| each header line + `\r\n` | the `{ ... }` list in `writeHead` |
| the blank line `"\r\n"` | done for us |
| `socket.write(body)` + `socket.end()` | `res.end(body)`: send and say goodbye in one go |

We give only the number `201`. The assistant knows it means "Created" and writes `HTTP/1.1 201 Created\r\n` itself.

It also adds labels we never wrote:

| Header | Plain words |
|---|---|
| `Date` | "This reply was made at this time" |
| `Connection: keep-alive` | "Don't hang up, you can ask more on this same line" |
| `Keep-Alive: timeout=5` | "...but if you're quiet for 5 seconds, I'll hang up" |

### Job 5: Don't repeat yourself (the `send` helper)

Every route needs the same `writeHead` + `end` lines. Instead of copying them six times, we wrap them in a **helper**:

```js
function send(res, status, contentType, body) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}
```

Now each route is one line:
```js
send(res, 404, "text/plain", "Nothing here\n");
```
Read it as: "send, on this reply form, status **404**, type **text**, saying **Nothing here**."

The old file did a similar trick differently: it set `status`, `contentType` and `body` inside the `if`s, then wrote the reply **once** at the bottom.

### What did NOT change

Exactly the same in both files:

- `loadNotes()` and `saveNotes()` (the notebook on the shelf)
- the routes: `/`, `/about`, GET notes, POST notes, 404
- the `try/catch` for bad JSON
- `server.listen(3000)`

**The lesson:** the `http` module didn't change **what the server does**. It only took over the **cutting and formatting**. The real logic (which page, which note, saving) is still ours. Express, the next level up, does the same thing again, just more of it.

## Run it

```bash
cd 02-http/build-a-server/step-07-http-module
node server.js
```

Full code: [`server.js`](./server.js)

## How it works

Same app, rewritten with Node's `http` module. It does the cutting-up we did by hand. Compare with the by-hand version in [Step 6](../step-06-save-to-file/server.js).

| By hand (`net`) | With `http` |
|---|---|
| `net.createServer((socket) => ...)` | `http.createServer((req, res) => ...)` |
| split first line → method | `req.method` |
| split first line → path | `req.url` |
| write status line + each header | `res.writeHead(200, { ...headers })` |
| `socket.write(body); socket.end()` | `res.end(body)` |
| cut at `\r\n\r\n` for the body | `req.on("data")` + `req.on("end")` |

```js
let requestBody = "";
req.on("data", (chunk) => {
  requestBody += chunk;
});
req.on("end", () => {
  // whole body has arrived, now JSON.parse it
});
```

**The body arrives in chunks**, like a long letter delivered page by page. `data` = "a page arrived, add it to the pile". `end` = "all pages here, read it". The by-hand server assumed one piece; it only worked because notes were tiny.

A helper keeps every reply to one line:

```js
function send(res, status, contentType, body) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}
```

Headers added for free:

| Header | In plain words |
|---|---|
| `Date` | When the reply was made |
| `Connection: keep-alive` | "Keep this line open, send more requests on it" |
| `Keep-Alive: timeout=5` | "...but I hang up after 5 idle seconds" |

Without our `Content-Length`, Node sends `Transfer-Encoding: chunked` instead: "the body comes in pieces, each with its size, and an empty piece means done".

**Mistake:** `SyntaxError: Invalid or unexpected token` with `^^^` under some text → a long line got split in two while copying. Text in `"..."` must stay on one line. Fix in nvim: go to the line, press `J` to join the next line onto it.

---

[← Step 6](../step-06-save-to-file/) · [All steps](../) · [Step 8 →](../step-08-crud/)
