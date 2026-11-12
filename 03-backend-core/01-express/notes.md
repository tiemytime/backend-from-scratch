# Express

[Backend core](../) · [Middleware →](../02-middleware/)

## 1. The problem

In [Stage 2](../../02-http/build-a-server/) we built a notes API with only Node's `http` module. It worked, but we had to do everything by hand:

- cut the URL into path and query string
- pull the id out of `/api/notes/7` with `split("/")`
- collect the body chunk by chunk, then `JSON.parse` it
- set `Content-Type` and `Content-Length` on every reply
- write one giant `if / else if` chain for all the routes

Every app needs the same plumbing. **Express is that plumbing, already written.**

## 2. In plain words

You built the whole shop yourself, down to the shelves. Express is a **ready-made shop fitting**. You only say "when someone asks for GET `/api/notes`, do this", and it handles the rest.

## 3. What Express replaced

| By hand (Stage 2) | Express | What it saves you |
|---|---|---|
| `http.createServer` + a big if/else | `app.get(...)`, `app.post(...)` | One small block per route |
| `new URL(...)` + `searchParams.get("search")` | `req.query.search` | Reading the query string |
| `path.split("/")[3]` | `/:id` + `req.params.id` | Reading parts of the path |
| `req.on("data")`, `req.on("end")`, `JSON.parse` | `app.use(express.json())` + `req.body` | Reading the body |
| `writeHead(201, {...})` + `end(JSON.stringify(...))` | `res.status(201).json(note)` | Headers set for you |
| final `else` → 404 | built in | "Cannot GET /x" for free |

The same server, side by side: [Stage 2 version](../../02-http/build-a-server/step-09-search/server.js) vs [Express version](./example.js).

## 4. Setup

```bash
cd 03-backend-core
pnpm install          # downloads Express into node_modules/
node 01-express/example.js
```

To start your own project from nothing: `pnpm init`, then `pnpm add express`. Add `node_modules` to `.gitignore`, because it's thousands of downloaded files anyone can get back with `pnpm install`.

## 5. The code, piece by piece

```js
const express = require("express");
const app = express();
app.use(express.json());
```

`require` loads the library. `express()` creates the app. `express.json()` reads JSON bodies into `req.body` (more on `app.use` in [Middleware](../02-middleware/)).

```js
app.get("/api/notes", (req, res) => {
  res.json(notes);
});
```

"When a **GET** comes for **`/api/notes`**, run this." Express gives you:

- `req` (request): what the customer sent. `req.query`, `req.params`, `req.body`, `req.get("Header-Name")`
- `res` (response): how you answer. `res.send(text)`, `res.json(data)`, `res.status(code)`, `res.end()`

```js
app.get("/api/notes/:id", (req, res) => {
  const note = notes.find((n) => n.id === Number(req.params.id));
  if (!note) {
    return res.status(404).json({ error: "No such note" });
  }
  res.json(note);
});
```

- `:id` is a blank to fill in. `/api/notes/7` gives `req.params.id === "7"`.
- It's the text `"7"`, not the number 7, because everything in a URL is text. Without `Number(...)`, `7 === "7"` is false and every note looks missing.
- `return` stops the function. Without it, the code goes on to `res.json(note)` and tries to answer twice: `Cannot set headers after they are sent`.

```js
res.status(201).json(note);   // 201 Created
res.status(204).end();        // 204 No Content, nothing to send
```

`status()` returns `res` again, so you can chain `.json()` onto it.

### `"utf8"` in `readFileSync(FILE, "utf8")`

On disk a file is just numbers (bytes). **UTF-8** is the codebook that turns them into letters: `A` is 1 byte, `é` is 2, `न` is 3, `😀` is 4. Without `"utf8"` you get raw bytes like `<Buffer 5b 0a 20 ...>`, and `JSON.parse` needs text.

## 6. Common mistakes

| Mistake | What happens |
|---|---|
| POST without `-H 'Content-Type: application/json'` | `express.json()` skips it, `req.body` is `undefined`, the route crashes with 500. Fixed in [Middleware](../02-middleware/). |
| Forgot `Number(req.params.id)` | Nothing is ever found |
| Forgot `return` before an early `res...` | Answers twice, crashes |
| Committed `node_modules` | Huge repo, and it breaks on other machines |

## 7. Other languages

The ideas are the same everywhere. Only the spelling changes.

| Language | Like Express | When people pick it |
|---|---|---|
| Python | **Flask** | Small apps, almost 1:1 with Express |
| Python | **FastAPI** | Modern APIs, the usual choice for serving ML models |
| Go | Gin, Echo, or the standard `net/http` | Fast services |
| Java | Spring Boot | Big companies |

## 8. Check yourself

<details>
<summary>1. What is <code>req.params.id</code> for <code>/api/notes/42</code>, and what type is it?</summary>

`"42"`, a string. Convert with `Number()`.
</details>

<details>
<summary>2. What's the difference between <code>req.query</code> and <code>req.params</code>?</summary>

`req.params` comes from blanks in the path (`/notes/:id`). `req.query` comes from after the `?` (`/notes?search=milk`).
</details>

<details>
<summary>3. Why <code>let notes</code> and not <code>const notes</code>?</summary>

DELETE replaces the whole list with `notes = notes.filter(...)`. A `const` can't be reassigned.
</details>
