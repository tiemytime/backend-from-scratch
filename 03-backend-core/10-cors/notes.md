# CORS

> Which websites may call your API from a browser.

## 1. The problem

Your API runs on `localhost:3000`. Your frontend (React, Vite, plain HTML) runs on `localhost:5173`. The frontend does:

```js
fetch("http://localhost:3000/api/notes")
```

and the browser console shows this red line:

```
Access to fetch at 'http://localhost:3000/api/notes' from origin 'http://localhost:5173'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
on the requested resource.
```

Yet `curl localhost:3000/api/notes` works perfectly. What's going on?

Every web developer hits this. Most copy-paste a fix without understanding it, and some of those fixes open a security hole. This topic explains what the browser is protecting, and how to let in exactly the sites you want.

## 2. Why browsers block this: the bank example

You're logged in to `bank.com`. Your browser holds its cookie.

In another tab you open `evil.com`. Its JavaScript runs:

```js
const res = await fetch("https://bank.com/api/balance", { credentials: "include" });
const data = await res.json();
// send data to the attacker...
```

The browser attaches **your** bank cookie to that request, because the request goes to `bank.com`. If `evil.com` could read the reply, any site you visit could read your bank balance, your email, your private notes.

So browsers have a rule, the **same-origin policy**:

> JavaScript on a page may only **read** replies from its own origin.

**CORS** (Cross-Origin Resource Sharing) is the controlled exception: the API itself can say "pages from these origins may read my replies".

## 3. In plain words: the office receptionist

| Office | Browser |
|---|---|
| You work in an office. A visitor (a web page) asks the receptionist to fetch a letter from another company. | A page's JavaScript calls `fetch()` on another origin. |
| The receptionist fetches it, then looks for a stamp: "OK to hand to visitors from X". | The browser sends the request, then checks the reply for `Access-Control-Allow-Origin: X`. |
| No stamp for this visitor? The receptionist keeps the letter. The visitor only hears "couldn't get it". | No matching header? JavaScript gets `TypeError: Failed to fetch`. The details are only in DevTools. |
| For anything unusual ("move money"), the receptionist **phones first**: "may I send this?" | **Preflight**: an `OPTIONS` request asking permission before the real one. |
| You walk to the other company yourself, no receptionist. | `curl`, Postman, another server. No browser, no CORS. |

Two things to notice:

1. The **server** decides who's allowed (by sending headers). The **browser** enforces it.
2. For simple requests the letter is **already fetched** when the receptionist refuses. The server did the work. Only the reading is blocked.

## 4. How it works underneath

### What's an origin?

**Origin = scheme + host + port.** All three must match to be "same origin".

| Page | API | Same origin? |
|---|---|---|
| `http://localhost:5173` | `http://localhost:3000` | **No**, different port |
| `http://localhost:3000` | `http://127.0.0.1:3000` | **No**, different host (same machine, still different text) |
| `http://example.com` | `https://example.com` | **No**, different scheme |
| `https://example.com/app` | `https://example.com/api` | **Yes**, the path doesn't count |

### Simple requests vs preflighted requests

The browser sorts every cross-origin `fetch` into one of two groups.

**Simple request**: sent straight away. All of these must be true:

- method is `GET`, `HEAD` or `POST`
- no custom headers (so no `Authorization`)
- `Content-Type`, if any, is `text/plain`, `application/x-www-form-urlencoded` or `multipart/form-data`

These are exactly the requests an old-fashioned HTML `<form>` could always send, so allowing them adds no new danger.

**Everything else is preflighted.** That includes `Content-Type: application/json`, any `Authorization: Bearer ...` header, and `PUT` / `PATCH` / `DELETE`. In other words: almost every real API call.

```
Simple request (GET from another origin):

  browser ----- GET /api/notes, Origin: http://localhost:5173 -----> server
  browser <---- 200, data, Access-Control-Allow-Origin: ... -------- server
  header matches the page's origin? yes -> JS gets the data
                                     no  -> JS gets "Failed to fetch"
                                            (but the server already ran the handler!)

Preflighted request (POST with JSON):

  browser ----- OPTIONS /api/notes ---------------------------------> server
                Origin: http://localhost:5173
                Access-Control-Request-Method: POST
                Access-Control-Request-Headers: content-type
  browser <---- 204, Allow-Origin / Allow-Methods / Allow-Headers -- server
  allowed? no  -> stop. The real POST is NEVER sent.
           yes -> send the real POST, then check its reply like a simple request
```

### The headers

**Sent by the browser** (automatically, you can't fake them from page JavaScript):

| Header | Meaning |
|---|---|
| `Origin` | "This request comes from a page on this origin" |
| `Access-Control-Request-Method` | (preflight only) "The real request will use this method" |
| `Access-Control-Request-Headers` | (preflight only) "...and these headers" |

**Sent by your server:**

| Header | Meaning |
|---|---|
| `Access-Control-Allow-Origin` | "This origin may read my reply". One origin, or `*` for everyone. Not a list. |
| `Access-Control-Allow-Methods` | (preflight) Methods allowed beyond the simple ones |
| `Access-Control-Allow-Headers` | (preflight) Headers the page may send, e.g. `Content-Type, Authorization` |
| `Access-Control-Allow-Credentials` | `true` = cookies may be included (section 6) |
| `Access-Control-Max-Age` | Seconds the browser may remember the preflight answer, so it doesn't ask before every request |
| `Access-Control-Expose-Headers` | Response headers JS may read beyond the basic ones (e.g. a custom `X-Total-Count`) |
| `Vary: Origin` | "My reply changes depending on Origin", so caches don't hand site A's reply to site B |

Since `Allow-Origin` holds only one value, servers with several allowed sites keep a list, check the incoming `Origin` against it, and **echo back** the one that matched. That's what `example.js` does.

## 5. The big misunderstanding: CORS doesn't protect your API

CORS protects **users' browsers** from malicious pages. It does nothing to protect **your server** from callers.

- `curl`, Postman, Python scripts and other servers don't care about CORS at all.
- An attacker can call your API directly whenever they like.
- Even from a browser, **simple requests reach your server and run**. CORS only hides the reply.

So CORS is **not** authentication and **not** authorization. Your API still needs login checks (topics 07, 08) and permission checks (topic 09) on every route. CORS is one extra layer, for one specific attack: a page in the user's own browser reading data it shouldn't.

You'll see this in the try-it section: the evil site's GET shows up in the API's log. The server answered. The browser just refused to hand the answer over.

## 6. Cookies across origins (credentials)

By default, cross-origin `fetch` does **not** send cookies. To send them, both sides must agree:

```js
// frontend
fetch("http://localhost:3000/api/me", { credentials: "include" });
```

```js
// server
res.set("Access-Control-Allow-Origin", "http://localhost:5173"); // exact origin, NOT *
res.set("Access-Control-Allow-Credentials", "true");
```

Rules:

- With credentials, `Allow-Origin: *` is **rejected** by the browser. You must name the exact origin. This stops "everyone may read my logged-in users' data".
- **Never** echo back any `Origin` you receive while also sending `Allow-Credentials: true`. That's the same as `*` with credentials, and it hands every logged-in user's data to every site on the internet (back to the bank example).
- The cookie's own `SameSite` setting (topic 07) applies too. A `SameSite=Lax` cookie isn't sent to a different **site** (different domain). `localhost:5173` and `localhost:3000` are the same site (port doesn't count for "site"), different origins.

If you use JWT in an `Authorization` header (topic 08) instead of cookies, you don't need credentials mode. The header just needs to be in `Allow-Headers`.

## 7. Options and when to pick which

| Approach | Plain words | Pick it when |
|---|---|---|
| **Same origin, no CORS at all** | Serve the frontend and API from one origin (`example.com` and `example.com/api`), using a reverse proxy like Nginx | Production, if you can. Simplest and safest. |
| **Dev proxy** | Vite/Next forward `/api` to `localhost:3000`, so the browser only sees one origin | Local development. In Vite: `server.proxy` in `vite.config.js` |
| **Allowlist of origins** | Echo back the origin only if it's on your list | Frontend on a different domain (`app.example.com` calling `api.example.com`). The normal choice. |
| **`*` (everyone)** | Any site may read the reply | Truly public, read-only data with no cookies: a weather API, public fonts, a CDN |
| **No CORS headers** | Browsers on other origins can't read anything | Server-to-server APIs, or APIs only used by mobile apps |

In real Express code you'd use the `cors` package instead of the hand-written middleware:

```bash
pnpm add cors
```

```js
const cors = require("cors");

app.use(cors({
  origin: ["http://localhost:5173", "https://app.example.com"], // allowlist, echoes the match
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // only if you use cookies
  maxAge: 600,
}));
```

Read the list from config (topic 05), e.g. `ALLOWED_ORIGINS=https://app.example.com`, so dev and production can differ without code changes.

Careful: `app.use(cors())` with **no options** means `*`. Fine for a public API, wrong for anything with logins.

## 8. Try it

You need a real browser for this. CORS is a browser feature, so `curl` alone can only show you the headers.

```bash
cd 03-backend-core/10-cors
node example.js
```

It starts **three** servers from one file:

| Address | What it is |
|---|---|
| `http://localhost:3000` | The API. Allows only `http://localhost:5173`. |
| `http://localhost:5173` | The notes app (on the guest list) |
| `http://localhost:4000` | The evil site (same page, different port, not on the list) |

**In the browser.** Keep the terminal visible next to it, and open DevTools (F12) on each page.

| Do this | Page shows | API terminal shows |
|---|---|---|
| Open `localhost:5173`, press **GET** | Status 200 + notes | `GET ... Origin: http://localhost:5173` |
| On `localhost:5173`, press **POST** | Status 201 + new note | `OPTIONS`, then `POST`, then `saved note` |
| Open `localhost:4000`, press **GET** | "Blocked by the browser" | **`GET ... Origin: http://localhost:4000`**. It arrived and was answered! |
| On `localhost:4000`, press **POST** | "Blocked by the browser" | Only `OPTIONS`. **No POST.** The preflight stopped it. |
| Look at DevTools > Console on `localhost:4000` | The real error: "blocked by CORS policy: No 'Access-Control-Allow-Origin' header" | |
| DevTools > Network, click the `OPTIONS` row on `localhost:5173` | Request and response headers from section 4 | |

**With curl** (a second terminal). `-i` shows the reply headers, `-H "Origin: ..."` pretends to be a page from that origin.

| Command | Look for |
|---|---|
| `curl -i localhost:3000/api/notes` | No `Access-Control-*` headers (no `Origin` sent), and the data. curl ignores CORS. |
| `curl -i localhost:3000/api/notes -H "Origin: http://localhost:5173"` | `Access-Control-Allow-Origin: http://localhost:5173` |
| `curl -i localhost:3000/api/notes -H "Origin: http://localhost:4000"` | No `Allow-Origin`, **but the data is still there**. Only browsers obey. |
| `curl -i -X OPTIONS localhost:3000/api/notes -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST"` | 204 with `Allow-Methods`, `Allow-Headers`, `Max-Age`: a preflight by hand |

## 9. Common mistakes

| Mistake | What happens |
|---|---|
| Thinking CORS secures the API | Anyone with curl still calls it. You still need auth on every route. |
| Trying to fix the CORS error in the frontend | Impossible. Only the server's headers can allow it. (Or use a dev proxy so it's not cross-origin.) |
| Installing a "disable CORS" browser extension | Works on your laptop only. Every real user still sees the error. |
| `Allow-Origin` echoes any origin + `Allow-Credentials: true` | Every website can read your logged-in users' data |
| `app.use(cors())` with no options on a private API | `*` for everyone. Harmless without cookies, but rarely what you meant. |
| `localhost` vs `127.0.0.1` | Different origins. Allowlisting one doesn't allow the other. |
| Trailing slash: allowlisting `http://localhost:5173/` | The `Origin` header never has a trailing slash, so nothing matches |
| Auth middleware runs before CORS and rejects `OPTIONS` with 401 | Browsers never send tokens on preflight, so every request fails. Put CORS first. |
| Forgetting `Authorization` in `Allow-Headers` | Login works, every protected call fails at preflight |
| Leaving out `Vary: Origin` while echoing origins | A cache may serve site A's `Allow-Origin` to site B and break it |

## 10. Check yourself

<details>
<summary>1. Your frontend on <code>localhost:5173</code> calls your API on <code>localhost:3000</code>. Both are on your laptop. Why is it cross-origin?</summary>

Origin is scheme + host + port. The ports differ (5173 vs 3000), so they're different origins, even on the same machine.
</details>

<details>
<summary>2. The evil site pressed GET. The page said "Blocked". Did the API run the handler?</summary>

Yes. A GET is a simple request, so the browser sent it, the server ran the handler and replied (you saw it in the API log). The browser then refused to let the page **read** the reply. This is why a GET must never change data: CORS doesn't stop it from running.
</details>

<details>
<summary>3. The evil site pressed POST (with JSON). Did the API save anything?</summary>

No. JSON makes it a preflighted request. The `OPTIONS` reply had no `Access-Control-Allow-Origin` for `localhost:4000`, so the browser never sent the real `POST`. The log shows only `OPTIONS`.
</details>

<details>
<summary>4. A teammate says "our API is safe from strangers, we set CORS to only allow our frontend". Are they right?</summary>

No. CORS only limits what **browsers** let pages read. Anyone can call the API with curl, Postman or a script, and get a full reply. Strangers are stopped by authentication and authorization, not CORS.
</details>

<details>
<summary>5. Why can't you use <code>Access-Control-Allow-Origin: *</code> together with cookies?</summary>

`*` with cookies would let every website on the internet make requests as your logged-in users and read the replies: the bank example from section 2. Browsers refuse that combination, so you have to name the exact origin you trust.
</details>

<details>
<summary>6. Your login route works from the frontend, but every call with <code>Authorization: Bearer ...</code> fails with a CORS error. What's the likely fix?</summary>

The `Authorization` header triggers a preflight, and the server doesn't list it in `Access-Control-Allow-Headers`. Add it. (Or the auth middleware is rejecting the `OPTIONS` preflight with 401, because preflights carry no token. Put CORS before auth.)
</details>
