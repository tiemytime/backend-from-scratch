# The Raw Server, In Plain Words

The story of what each step of the raw server does, with no code jargon. Read this first, then [notes.md](./notes.md) for the technical version.

Picture the server as a **small shop with a counter**. A customer (curl or a browser) walks in and asks for something.

---

## Steps 1 to 6: what we built by hand

### Step 1: Open the shop
We unlocked the door (port 3000) and sat behind the counter. When a customer came in and spoke, we **heard** them and wrote down what they said.

But we never answered. The customer just stood there waiting forever. That's why curl hung.

### Step 2: Learn to answer
Now when someone asks, we reply in the shop's official format:

1. "OK" (the **status**)
2. a few labels about the answer (the **headers**)
3. a blank pause (an empty line)
4. the actual answer (the **body**)

Then we say goodbye and close the conversation.

### Step 3: Different answers for different questions
Before, we said "Hello" to everyone, whatever they asked. Now we listen to **what** they want:

- Ask for the home page, get the home page.
- Ask for "about", get the about page.
- Ask for "banana", get **"we don't have that" (404)**.

Picking the answer based on what was asked is called **routing**.

### Step 4: Answers that apps can read
Plain text is fine for people. Apps need answers in a strict, tidy format, so we answer in **JSON**. Every answer also carries two labels:

- **what kind of answer it is** (Content-Type: text or JSON)
- **how big it is** (Content-Length), so the customer knows when we've finished talking

### Step 5: Customers can give us things
Until now customers only **asked**. Now they can **hand us a new note** (a POST request).

- We open what they handed over, add it to our list, and say **"Created" (201)**.
- If they hand us garbage, we don't panic. We say **"that's broken" (400)** and keep working.

### Step 6: A notebook instead of a whiteboard
Our list was written on a whiteboard (memory). Every time the shop closed, someone wiped it.

Now we also copy it into a **notebook on the shelf** (`notes.json`). When the shop opens again, we read the notebook and remember everything.

---

## Step 7: Hire an assistant

So far we did all the boring work by hand: cutting the request into pieces, finding the blank line, writing every label ourselves.

Node has a built-in assistant, the `http` module, that does that cutting for us.

- **Old way (`net`, in `server.js`):** the customer hands us **one long scrap of paper** with everything scribbled on it. We cut it up ourselves to find what they want.
- **New way (`http`, in `server-http.js`):** the assistant takes the scrap, cuts it up, and hands us **a neat filled-in form** (`req`) plus **a blank reply form** (`res`). We read the boxes and fill in our answer.

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

---

## Coming next

### Step 8: Work with one specific note
Right now customers can only say "show me **all** notes" or "add a note". Next they can point at **one** note:

- "show me note **3**"
- "**change** note 3"
- "**throw away** note 3"

Show, add, change, delete together are called **CRUD**. Almost every app in the world is CRUD with extra steps. This step also reveals a bug in our numbering: after a delete, two notes can end up with the same number.

### Step 9: Search and filter
Customers add extra wishes to the address, like `/api/notes?search=milk`, meaning "only notes containing milk". The part after `?` is a **query string**. Same idea as Google reading your search from its URL.
