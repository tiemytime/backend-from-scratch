# Middleware

[← Express](../01-express/) · [Backend core](../)

## 1. The problem

Say your app has 20 routes. Every one of them needs to:

- log the request
- turn the JSON body into an object
- check the user is logged in
- handle crashes without showing an ugly error page

Copy-pasting that into 20 routes means 20 places to forget it and 20 places to fix when it changes.

**Middleware is code that runs on the way to your route, written once, used everywhere.**

## 2. In plain words

Picture the shop again. Before a customer reaches the counter, they walk past a **row of staff**:

```
customer → [door guard] → [person who opens parcels] → [ID checker] → counter
```

Each staff member can do one of two things:

1. **Let the customer through** to the next person (`next()`)
2. **Send them home with an answer** (`res.status(...).json(...)`)

If a staff member does neither, the customer stands there forever. (That's a hanging request, like your Step 1 server.)

## 3. How it works underneath

Express keeps a **list of functions** in the order you added them. For each request it calls the first one and hands it a function called `next`. Calling `next()` means "call the one after me".

That's all. Here it is in 15 lines, no Express: [`how-next-works.js`](./how-next-works.js)

```js
const stack = [];

function use(fn) {
  stack.push(fn);
}

function handle(req, res) {
  let i = 0;
  function next() {
    const fn = stack[i];
    i++;
    if (fn) {
      fn(req, res, next);
    }
  }
  next();
}
```

```bash
node how-next-works.js
```

```
--- request with a user ---
1. logger sees /notes
2. guard: user is asha
3. route: sending the reply
--- request without a user ---
1. logger sees /notes
2. guard: no user, stopping here
```

The second request never reaches the route, because the guard didn't call `next()`.

**Routes are middleware too.** `app.get("/x", fn)` is just "a function in the list that only runs for GET /x". The only difference is that a route usually ends with an answer instead of `next()`.

## 4. The shape of a middleware

| Kind | Shape | Job |
|---|---|---|
| Normal | `(req, res, next) => { ... }` | Do something, then `next()` or answer |
| Error handler | `(err, req, res, next) => { ... }` | Catch anything that went wrong |

Express tells them apart **by counting the arguments**. Four arguments means error handler. Write three and Express thinks it's normal middleware, so your errors are never caught by it.

## 5. Three places to attach middleware

| Where | Code | Runs for |
|---|---|---|
| **Global** | `app.use(fn)` | Every request |
| **Path** | `app.use("/admin", fn)` | Only paths starting with `/admin` |
| **Route** | `app.post("/api/notes", fn, handler)` | Only that one route |

**How to choose:** attach it as narrowly as makes sense.

- Logging, request ids, body parsing → global. Everyone needs them.
- "Must be an admin" → path. The whole `/admin` area needs it.
- "Body must be JSON" → route. Only POST and PUT have a body.

## 6. Order matters

Express walks the list **top to bottom**. So the usual order in a file is:

```
1. request id, logger       ← see everything, even failures
2. body parsers             ← so routes can read req.body
3. path guards (auth)       ← before the routes they protect
4. routes
5. 404 catch-all            ← reached only if no route answered
6. error handler            ← last, catches errors from everything above
```

Put the 404 at the top and **every** request gets a 404. Put the logger after the routes and it never sees requests the routes answered.

## 7. Passing data down the line

A middleware can **stick something on `req`** for the ones after it:

```js
app.use((req, res, next) => {
  req.id = crypto.randomUUID().slice(0, 8);
  next();
});
```

Now every later function can read `req.id`. This is how real apps do login: an auth middleware checks the token and sets `req.user`, and routes just read `req.user`. You'll see that in the auth topic.

## 8. Errors

When code inside a route **throws**, Express skips every normal middleware and jumps to the first **error handler**.

```js
app.use((err, req, res, next) => {
  console.log(req.id, "ERROR:", err.message);
  res.status(500).json({ error: "Something broke on our side", requestId: req.id });
});
```

- Log the real error **on the server**. Send the user only a **short safe message**. A raw error can leak file paths, library versions and SQL.
- Sending back the `requestId` means a user can report "I got error 8e160c44" and you can find the exact log line.
- **Express 5** also catches errors thrown inside `async` routes. **Express 4 didn't**: an async error crashed the request or hung it, and people wrapped every route in a helper. Old tutorials still show that wrapper. With Express 5 you don't need it.
- You can also jump to the error handler yourself with `next(err)`.

## 9. Ready-made middleware and when to use it

You rarely write all of it yourself.

| You need | Middleware | Comes with |
|---|---|---|
| Read JSON bodies | `express.json()` | Express |
| Read HTML form bodies | `express.urlencoded()` | Express |
| Serve files (images, CSS, a frontend) | `express.static("public")` | Express |
| Request logging | `morgan` | install |
| Let a frontend on another domain call you | `cors` | install |
| Safe security headers | `helmet` | install |
| Stop someone sending 1000 requests a second | `express-rate-limit` | install |
| Read cookies | `cookie-parser` | install |

We wrote our own logger to see how it works. In a real app, use `morgan` or a logger like `pino`.

## 10. Real-world example: "Add to Cart" on a shopping site

Amazon's code is private, but every big shopping site needs the same guards. When you click **Add to Cart**, the browser sends:

```
POST /api/cart
Cookie: session=abc123
Body: {"productId": "B08XYZ", "quantity": 2}
```

Before the cart code runs, the request walks past about 10 guards:

| # | Guard | Why it exists | In plain words |
|---|---|---|---|
| 1 | Request ID | Find one request among millions in the logs | A token number, like at a hospital |
| 2 | Logger | Know what's slow, what fails, how busy you are | The visitor book |
| 3 | Security headers (`helmet`) | Stop tricks like loading the site inside a fake page | "Do not open in a strange place" sticker |
| 4 | CORS | Only allowed websites may call the API from a browser | A guest list |
| 5 | Rate limiter | Stop bots trying 10,000 passwords or flooding a sale | "Max 100 visits a minute" (429 Too Many Requests) |
| 6 | Body parser | Turn the JSON text into `req.body` | The parcel opener |
| 7 | Auth | Know **whose** cart this is | Check the membership card, pin a name tag (`req.user`) |
| 8 | Validation | Reject `quantity: -5` or junk | Check the order form is filled in properly |
| → | **Route** | Add the item to the cart | The counter |
| 9 | 404 | Unknown address | "No such counter" |
| 10 | Error handler | Something crashed | The manager who hides the mess in the back room |

Because the guards did all the checking, the route itself is tiny:

```js
function addToCart(req, res) {
  cart.add(req.user.id, req.body.productId, req.body.quantity);
  res.status(201).json({ ok: true });
}
```

**Where each guard stands:**

| Guard | Attached | Why |
|---|---|---|
| Request ID, logger, headers, CORS, body parser | everywhere (`app.use(fn)`) | every request needs them |
| Rate limiter | some paths (`/api/login`, `/api/checkout`) | where attacks happen |
| Auth | some paths (`/api/cart`, `/api/orders`, `/api/account`) | browsing doesn't need login, buying does |
| Validation | each route | every form has different fields |
| 404, error handler | at the end | catch whatever is left |

```js
app.use("/api/cart", requireLogin);
app.use("/api/orders", requireLogin);
app.use("/api/account", requireLogin);
// /api/products has no guard, so anyone can browse
```

**Two kinds of auth guard.** On Amazon you can add to cart while logged out (a "guest cart" kept with a cookie), and only checkout forces login. So real apps use:

| Guard | If not logged in | Used on |
|---|---|---|
| `requireLogin` | stop with 401 | orders, account, checkout |
| `optionalLogin` | let through, just no `req.user` | cart, product pages ("Hello, sign in" vs "Hi, Asha") |

**The same pattern outside your code.** Big companies also put guards in front of the server:

```
you → CDN → load balancer → API gateway → Express app (its own middleware) → database
```

| Layer | Its job as a guard |
|---|---|
| CDN (e.g. CloudFront) | Serve files from a server near you, absorb huge attacks (DDoS) |
| Load balancer | Send you to a server that isn't busy |
| API gateway | Check API keys and rate limits before your code even runs |

Same idea at every level: **a line of checkpoints, each one passes the request on or stops it.**

Open-source apps that use Express middleware like this: [Ghost](https://github.com/TryGhost/Ghost) (blogging platform), and the `examples/` folder in [expressjs/express](https://github.com/expressjs/express).

## 11. Keeping middleware in its own file

Real projects don't keep every guard in `server.js`. Working example: [`split-files/`](./split-files/)

**One file makes the guards. The main file imports them and puts them in order.**

[`split-files/middleware.js`](./split-files/middleware.js) defines them and exports them:

```js
function requestId(req, res, next) { ... }
function logger(req, res, next) { ... }
function requireAdmin(req, res, next) { ... }
function notFound(req, res) { ... }
function errorHandler(err, req, res, next) { ... }

module.exports = { requestId, logger, requireAdmin, notFound, errorHandler };
```

Defining a function doesn't run it. `module.exports` lets other files borrow these functions. Without it they're invisible outside this file.

[`split-files/server.js`](./split-files/server.js) imports them and decides the order:

```js
const { requestId, logger, requireAdmin, notFound, errorHandler } = require("./middleware");

app.use(requestId);
app.use(logger);
app.use(express.json());
app.use("/admin", requireAdmin);

app.get("/api/notes", ...);
app.get("/admin/stats", ...);

app.use(notFound);
app.use(errorHandler);
```

- `require("./middleware")`: `./` means "this folder", and `.js` can be left off.
- `app.use(logger)`, **not** `app.use(logger())`. You hand Express the function, and Express calls it when a request arrives. With `()` you'd call it right now, with no request.
- **Only the order of the `app.use` lines in `server.js` decides the flow.** The order inside `middleware.js` doesn't matter.

```bash
node split-files/server.js
curl localhost:3000/admin/stats      # 401
```

In bigger apps each guard gets its own file in a `middleware/` folder (`auth.js`, `logger.js`, `errorHandler.js`, ...). The rule stays the same: files store the guards, the main file puts them in order.

## 12. Try it

[`example.js`](./example.js) has all three kinds (global, path, route), plus a 404 and an error handler.

```bash
cd 03-backend-core/02-middleware
node example.js     # terminal 1, watch the logs here
```

In terminal 2:

| Command | You get | Who answered |
|---|---|---|
| `curl localhost:3000/api/notes` | 200, the notes | the route |
| `curl localhost:3000/api/notes -H 'Content-Type: application/json' -d '{"text":"Call mom"}'` | 201 | the route |
| `curl localhost:3000/api/notes -d '{"text":"x"}'` | 415 | `requireJson` stopped it |
| `curl localhost:3000/api/notes -H 'Content-Type: application/json' -d '{bad'` | 400 | `express.json()` threw, error handler answered |
| `curl localhost:3000/admin/stats` | 401 | the `/admin` guard |
| `curl localhost:3000/admin/stats -H 'X-Admin-Key: letmein'` | 200 | the route |
| `curl localhost:3000/boom` | 500 with a requestId | error handler |
| `curl localhost:3000/boom-async` | 500 | error handler (async, Express 5) |
| `curl localhost:3000/nope` | 404 | the catch-all |
| `curl -i localhost:3000/api/notes` | see the `X-Request-Id` header | request id middleware |

Terminal 1 shows one line per request:

```
0645dd4d ERROR: Expected property name or '}' in JSON at position 1
0645dd4d POST /api/notes 400 1ms
17e32e03 GET /admin/stats 200 0ms
```

The same id on the ERROR line and the request line lets you match them up.

## 13. Common mistakes

| Mistake | What happens |
|---|---|
| Forgot `next()` | Request hangs forever, curl never returns |
| Called `next()` **and** sent an answer | `Cannot set headers after they are sent` |
| Forgot `return` before `res.status(...)` in a guard | The code continues, calls `next()`, same error as above |
| Error handler with 3 arguments | It's treated as normal middleware, errors fall through to Express's ugly HTML page |
| 404 catch-all placed above routes | Everything is a 404 |
| Logging `req.url` inside path middleware | Express cuts the mount path off: `/admin/stats` shows as `/stats`. Use `req.originalUrl`. (Found this while testing the example.) |
| Sending `err.message` or the stack to users | Leaks internals of your server |

## 14. Check yourself

<details>
<summary>1. What's the difference between middleware and a route?</summary>

None underneath. Both are functions in the same list. A route is middleware that only matches one method and path, and usually answers instead of calling `next()`.
</details>

<details>
<summary>2. Why does the logger use <code>res.on("finish")</code> instead of logging right away?</summary>

When the logger runs, the route hasn't run yet, so there's no status code. `finish` fires after the reply is sent, when the status and time are known.
</details>

<details>
<summary>3. How does Express know a function is an error handler?</summary>

It has exactly 4 arguments: `(err, req, res, next)`.
</details>

<details>
<summary>4. You want only logged-in users to reach anything under <code>/api</code>. Where do you attach the check?</summary>

`app.use("/api", requireLogin)`, after the body parser and before the `/api` routes.
</details>

<details>
<summary>5. An async route throws. What happens in Express 4 vs Express 5?</summary>

Express 4: the error is not caught, the request hangs or the process warns about an unhandled rejection. Express 5: it goes to the error handler like any other error.
</details>
