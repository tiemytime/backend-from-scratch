# Project structure

[← Validation](../03-validation/) · [Backend core](../) · [Config and env vars →](../05-config-env/)

## 1. The problem

Every example so far lives in **one file**. That's fine for 50 lines. A real app has users, notes, orders, payments and login, which is hundreds of routes and thousands of lines. In one file:

- You scroll forever to find anything.
- Two people editing the same file keep clashing in git.
- Changing how data is stored (a file today, a database tomorrow) means touching every route.
- You can't test the "real work" without starting a server and sending HTTP requests.

**Project structure means splitting the code into files and folders where each one has one job.**

## 2. In plain words: a restaurant

A small food stall: one person takes the order, cooks, takes the money and cleans. Fine for 5 customers a day.

A real restaurant splits the work:

| Restaurant | Job | In our code |
|---|---|---|
| **Menu** | Lists what you can order and which counter handles it | **routes** |
| **Security at the door** | Checks people before they sit down | **middleware** |
| **Order form rules** | What a valid order looks like | **schemas** |
| **Waiter** | Takes your order, carries it to the kitchen, brings the food back | **controllers** |
| **Kitchen** | Actually cooks. Never talks to customers. | **services** |
| **Manager's plan** | Opens the restaurant, decides where everyone stands | **app.js** |
| **Opening the front door** | Unlocks and lets people in | **server.js** |

The key idea: **the kitchen doesn't know about customers, and the waiter doesn't cook.**

## 3. The folders

```
04-project-structure/
└── src/
    ├── server.js                       ← opens the port
    ├── app.js                          ← builds the app: guards + routers in order
    ├── routes/
    │   └── notes.routes.js             ← which URL → which controller
    ├── controllers/
    │   └── notes.controller.js         ← reads req, calls the service, sends res
    ├── services/
    │   └── notes.service.js            ← the real work and the data
    ├── schemas/
    │   └── notes.schema.js             ← what correct data looks like (zod)
    └── middleware/
        ├── logger.js
        ├── validate.js
        ├── notFound.js
        └── errorHandler.js
```

## 4. How one request travels

```bash
curl localhost:3000/api/notes -H 'Content-Type: application/json' -d '{"text":"Call mom"}'
```

```
server.js       port 3000 receives it
   ↓
app.js          logger → express.json() → "/api/notes" goes to the notes router
   ↓
notes.routes    POST "/" → validateBody(createNoteSchema) → notesController.create
   ↓
controller      takes req.body, calls notesService.createNote(req.body)
   ↓
service         makes the note, stores it, returns it
   ↓
controller      res.status(201).json(note)
```

Each file does one small step and passes the request on.

## 5. Each file, explained

### `server.js`: open the door

```js
const app = require("./app");

app.listen(3000, () => {
  console.log("Listening on port 3000");
});
```

Only this file opens a port.

### `app.js`: put everyone in their place

```js
const app = express();

app.use(logger);
app.use(express.json());

app.use("/api/notes", notesRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
```

This is the [middleware](../02-middleware/) order you already know: guards, then routes, then 404, then the error handler. Reading this one file tells you how the whole app is wired.

**Why split `app.js` and `server.js`?** Tests can `require("./app")` and send fake requests to it **without opening a real port**. Tools like `supertest` do exactly this. If `app.js` called `listen` itself, every test would start a real server.

### `routes/notes.routes.js`: the menu

```js
const router = express.Router();

router.get("/", notesController.list);
router.post("/", validateBody(createNoteSchema), notesController.create);
router.get("/:id", validateId, notesController.getOne);
router.patch("/:id", validateId, validateBody(updateNoteSchema), notesController.update);
router.delete("/:id", validateId, notesController.remove);

module.exports = router;
```

- **`express.Router()`** is a **mini app**: a separate list of routes you can plug into the main app.
- In `app.js`, `app.use("/api/notes", notesRoutes)` plugs it in **under `/api/notes`**.
- So inside the router, the paths are **relative**: `"/"` really means `/api/notes`, and `"/:id"` really means `/api/notes/:id`.
- One glance at this file shows **every** notes URL and the guards in front of each. That's why it's called the menu.

Adding users later is just one new router:

```js
app.use("/api/users", usersRoutes);
```

### `controllers/notes.controller.js`: the waiter

```js
function getOne(req, res) {
  const note = notesService.getNote(req.noteId);
  if (!note) {
    return res.status(404).json({ error: "No such note" });
  }
  res.json(note);
}
```

The controller is **the only place that speaks HTTP**:

- reads from `req` (body, params, query)
- calls the service with plain values
- picks the status code and sends the response

It doesn't store data or apply business rules.

### `services/notes.service.js`: the kitchen

```js
let notes = [{ id: 1, text: "Buy milk", pinned: false }];

function getNote(id) {
  return notes.find((n) => n.id === id);
}

function createNote(data) {
  const nextId = Math.max(0, ...notes.map((n) => n.id)) + 1;
  const note = { id: nextId, ...data };
  notes.push(note);
  return note;
}
```

**The service knows nothing about HTTP.** No `req`, no `res`, no status codes. Only plain inputs and plain outputs.

Why that matters:

1. **Reuse.** The same `createNote` can be called from an HTTP route, a command-line script, a scheduled job, or a test. None of those have `req` or `res`.
2. **Swapping storage.** Today the notes are in an array. In Stage 4 they go into Postgres. **Only this file changes.** Routes and controllers don't notice.
3. **Testing.** `createNote({ text: "hi" })` can be tested directly, with no server.

### `schemas/` and `middleware/`

Same code as the [Validation](../03-validation/) and [Middleware](../02-middleware/) topics, just moved into their own files with `module.exports`.

### "Schema": zod or database?

**Schema** just means "a description of what data should look like", and the word is used for two different things:

| | Zod schema (what's in `schemas/`) | Database schema (Stage 4) |
|---|---|---|
| Describes | the data in a **request** | a **table** in the database |
| Written in | JavaScript | SQL (`CREATE TABLE ...`) |
| Job | "Is what the user sent correct?" | "What columns exist, and what type is each?" |
| Runs | on every request | set up once, enforced on every save |
| Shop | the teller checking the deposit slip | the shape of the shelves in the stock room |

```
user → [zod schema: is the request OK?] → your code → [database schema: does it fit the table?] → database
```

You want both. Zod catches bad input **early** with a friendly message. The database schema is the **last wall**, which still holds even if your code has a bug. In this project, `schemas/` holds only zod schemas. Some projects call that folder `validators/` to avoid the confusion.

## 6. How files connect: `require` and `module.exports`

```js
// services/notes.service.js
module.exports = { listNotes, getNote, createNote, updateNote, deleteNote };

// controllers/notes.controller.js
const notesService = require("../services/notes.service");
notesService.getNote(1);
```

| Path | Means |
|---|---|
| `./app` | `app.js` in **this** folder |
| `../services/notes.service` | go **up one** folder, then into `services/` |
| `express` (no dot) | a library from `node_modules/` |

Two ways to export:

```js
module.exports = logger;                          // one thing → const logger = require("./logger")
module.exports = { validateBody, validateId };    // several → const { validateBody } = require("./validate")
```

## 7. Who may call whom

```
routes → controllers → services → (data: array today, database later)
```

Arrows only point **one way**.

| Rule | Why |
|---|---|
| Services never use `req` or `res` | So they work outside HTTP and can be tested alone |
| Controllers never store data directly | So swapping the database touches only services |
| Services never call controllers | Kitchen doesn't give orders to waiters |
| Routes contain no logic, only "URL → guards → controller" | So the menu stays readable |

## 8. Two common ways to organise folders

**By layer** (what we did): one folder per kind of file.

```
src/
├── routes/        notes.routes.js, users.routes.js
├── controllers/   notes.controller.js, users.controller.js
└── services/      notes.service.js, users.service.js
```

**By feature**: one folder per part of the app.

```
src/
├── notes/    notes.routes.js, notes.controller.js, notes.service.js, notes.schema.js
└── users/    users.routes.js, users.controller.js, users.service.js, users.schema.js
```

| | By layer | By feature |
|---|---|---|
| Easy to learn | ✅ | |
| Good for | small and medium apps | big apps, many teams |
| Changing "notes" means | opening 4 folders | opening 1 folder |
| Used by | most tutorials, many Express apps | NestJS, large codebases |

Both are fine. Pick one and stay consistent. Big companies usually end up "by feature", because each team owns one feature folder.

## 9. Real-world: how a shop like Amazon might split it

```
src/
├── products/   routes, controller, service   ← browse, search
├── cart/       routes, controller, service   ← add, remove
├── orders/     routes, controller, service   ← place, track, cancel
├── payments/   routes, controller, service   ← talks to the bank
├── users/      routes, controller, service   ← signup, profile
└── middleware/ auth, rateLimit, logger, errorHandler
```

"Place order" in the orders service might call the cart service (what's in the cart?), the payments service (charge the card) and the products service (reduce stock). **Services call other services. Controllers stay thin.**

At very large scale, each of those folders can become its **own separate server**, called a **microservice**, with its own team and database. That's a later topic. It starts with exactly this kind of split.

## 10. Try it

```bash
cd 03-backend-core/04-project-structure
node src/server.js
```

| Command | Result | Path through the files |
|---|---|---|
| `curl localhost:3000/api/notes` | 200, list | routes → `list` → `listNotes` |
| `curl localhost:3000/api/notes -H 'Content-Type: application/json' -d '{"text":" Call mom "}'` | 201, trimmed | routes → `validateBody` → `create` → `createNote` |
| `curl "localhost:3000/api/notes?search=MOM"` | 200, matches | `list` passes `req.query.search` to `listNotes` |
| `curl localhost:3000/api/notes/abc` | 400 | stopped by `validateId` |
| `curl -X PATCH localhost:3000/api/notes/2 -H 'Content-Type: application/json' -d '{"pinned":true}'` | 200 | `validateId` → `validateBody` → `update` → `updateNote` |
| `curl -X DELETE localhost:3000/api/notes/2` | 204, then 404 the second time | `remove` → `deleteNote` returns `false` |
| `curl localhost:3000/nope` | 404 | no router matched → `notFound` |

The behaviour is exactly the same as the one-file [Validation example](../03-validation/example.js). **Only the organisation changed.** That's the point.

## 11. Common mistakes

| Mistake | What happens |
|---|---|
| Passing `req` or `res` into a service | The service only works inside HTTP, can't be reused or tested alone |
| Business logic in routes or controllers | Same rule copied in many places, they drift apart |
| Writing the full path inside a router: `router.get("/api/notes/:id")` | With `app.use("/api/notes", router)` it becomes `/api/notes/api/notes/:id` |
| `app.listen` inside `app.js` | Tests open real ports and clash |
| Forgetting `module.exports` | `require` gives you `{}`, then "x is not a function" |
| Wrong relative path (`./services` from inside `controllers/`) | `Cannot find module`. You need `../services` |
| Splitting a 30-line app into 10 folders | Overkill. Split when one file starts to hurt. |

## 12. Check yourself

<details>
<summary>1. A note can now be created from a daily scheduled job, not just HTTP. Which file do you reuse?</summary>

The service (`createNote`). It doesn't need `req` or `res`, so anything can call it.
</details>

<details>
<summary>2. In Stage 4 notes move from an array into Postgres. Which files change?</summary>

Only `services/notes.service.js`. Routes, controllers, schemas and middleware stay the same.
</details>

<details>
<summary>3. The router has <code>router.get("/:id", ...)</code>. What's the full URL?</summary>

`/api/notes/:id`, because `app.js` mounts the router with `app.use("/api/notes", notesRoutes)`.
</details>

<details>
<summary>4. Where does the 404 "No such note" decision live, and why there?</summary>

In the controller. The service only says "not found" by returning `null` or `false`. Turning that into an HTTP status code is the controller's job, because only the controller knows about HTTP.
</details>

<details>
<summary>5. Why keep <code>app.js</code> and <code>server.js</code> separate?</summary>

So tests can import the app and send fake requests without opening a real port.
</details>
