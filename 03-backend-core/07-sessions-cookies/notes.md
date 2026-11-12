# Sessions and cookies

[← Password hashing](../06-password-hashing/) · [Backend core](../)

## 1. The problem

In the last topic, login worked: right password, `200 Logged in`. Then you ask for `/api/me` and the server says "who are you?"

That's because **HTTP has no memory**. Every request arrives on its own, like a stranger walking in. The server doesn't know that the request a second ago came from the same person. This is called being **stateless**.

You can't make people send their password with every single request (slow, because bcrypt is slow on purpose, and the password would be flying around constantly).

**Goal: after one login, the server recognises the same person on every following request, until they log out or the login expires.**

## 2. In plain words: the cloakroom ticket

You hand your coat to a cloakroom. They give you a **ticket with a number**: `#4817`.

- The **coat stays with them**, hanging on hook 4817. You only carry the ticket.
- When you come back, you show the ticket, they look up hook 4817, and give you your coat.
- The ticket on its own is worthless paper. Its power comes from **their** list.
- If they throw away hook 4817's coat, your ticket is dead, even if you still hold it.
- Anyone holding your ticket gets your coat. So **don't lose it**.

| Cloakroom | Web |
|---|---|
| The coat | Who you are: user id, when you logged in |
| The hook list | The **session store** on the server |
| The ticket number | The **session id** |
| Your pocket | A **cookie** in your browser |
| Showing the ticket | The browser sending the cookie with every request |

So two separate ideas:

- **Cookie**: a small piece of text the browser stores and **sends back automatically**. The pocket.
- **Session**: the record the **server** keeps about a logged-in person. The coat on the hook.

## 3. Cookies, underneath

A cookie is just two headers. Nothing more magic than that.

**Step 1.** The server's response includes `Set-Cookie`:

```
HTTP/1.1 200 OK
Set-Cookie: sid=fa06597c...; Max-Age=3600; Path=/; HttpOnly; SameSite=Lax
```

**Step 2.** The browser saves it. From now on, every request it sends **to that same site** carries:

```
GET /api/me HTTP/1.1
Cookie: sid=fa06597c...
```

The browser does this **by itself**. Your frontend code doesn't need to do anything. (Remember from HTTP notes: cookies belong to the **host**, not the port.)

`curl` doesn't save cookies unless you tell it to. `-c jar.txt` saves them to a file, `-b jar.txt` sends them back. That's how we pretend to be a browser below.

### The settings on a cookie

The bit after the value (`Max-Age=3600; HttpOnly; ...`) are rules **for the browser**.

| Attribute | Plain words | Why it matters |
|---|---|---|
| `HttpOnly` | JavaScript on the page can't read it | If an attacker sneaks a script into your page (XSS), it can't steal the ticket |
| `Secure` | Only sent over HTTPS | On café Wi-Fi, nobody can read it in transit. Off in local dev because `localhost` is plain HTTP. |
| `SameSite=Lax` | Not sent when **another website** submits a form/POST to you | Blocks most CSRF (see section 8) |
| `Max-Age=3600` / `Expires` | Browser deletes it after this | Logins don't last forever |
| `Path=/` | Send it for every path on the site | Usual for session cookies |
| `Domain` | Which hosts get it. Leave it out = only this exact host. | Setting it too wide shares it with subdomains |

For a login cookie, always: **`HttpOnly`, `Secure` (in production), `SameSite=Lax`, an expiry.**

## 4. Sessions, underneath

The server keeps a table:

```
session id (random)                         | userId | expiresAt
fa06597c50d321343afb57d9232807de62201deb...  | 1      | 13:14
9b1e0c7d4a...                                | 7      | 13:40
```

On every request:

```
request comes in
  → read the Cookie header → sid=fa06597c...
  → look it up in the session table
  → found and not expired?  req.user = user 1
  → not found / expired?    req.user stays empty
  → the route decides: needs login? 401. Doesn't? carry on.
```

### Why not just put `userId=1` in the cookie?

Because **the user controls their cookies**. They can edit it in devtools to `userId=2` and become someone else.

The session id works because it is:

- **random**: 32 random bytes, 64 hex characters. There are more possible ids than atoms in the universe. You can't guess someone else's.
- **meaningless**: it says nothing about the user. The truth lives on the server.

Never use something guessable as a session id: counters (`1, 2, 3`), the email, a timestamp, `Math.random()`. Use `crypto.randomBytes`.

## 5. The code

```bash
cd 03-backend-core/07-sessions-cookies
node example.js
```

### The store

```js
const sessions = new Map(); // sessionId -> { userId, expiresAt }
```

A `Map` is a dictionary: put in with `.set(key, value)`, read with `.get(key)`, remove with `.delete(key)`. It lives in memory, so restarting the server logs everyone out. Fine for learning, see section 7 for real apps.

### Login: make a session, hand over the ticket

```js
if (req.sessionId) sessions.delete(req.sessionId);
const sid = createSession(user.id);
res.cookie("sid", sid, cookieOptions);
```

`res.cookie` is Express writing the `Set-Cookie` header for you. Notice we only do this **after** bcrypt says the password is right.

The `delete` line: if this browser already had a session, throw it away and always issue a **fresh** id on login. Why is in section 8 (session fixation).

### Every request: who is this?

```js
function loadUser(req, res, next) {
  const sid = parseCookies(req.headers.cookie).sid;
  const session = sid && sessions.get(sid);
  if (session && session.expiresAt > Date.now()) { ... req.user = ... }
  ...
  next();
}
app.use(loadUser);
```

This is **middleware** (topic 02). It runs before every route. It never blocks; it only answers "who is this, if anyone?"

`parseCookies` turns the raw header `"sid=abc; theme=dark"` into `{ sid: "abc", theme: "dark" }`. In real projects the `cookie-parser` package does this; here it's written out so you see there's nothing hidden.

Why check `expiresAt` on the server when the cookie already has `Max-Age`? Because `Max-Age` is a **request to the browser**. A stolen cookie copied into curl ignores it completely. **The server's own expiry is the one that counts.**

### Guard: must be logged in

```js
function requireLogin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Please log in" });
  next();
}

app.get("/api/me", requireLogin, (req, res) => { ... });
```

Two middlewares with two jobs: `loadUser` (who?) runs everywhere, `requireLogin` (must be someone) only on routes that need it. A public page like the home page just skips `requireLogin`.

### Logout

```js
sessions.delete(req.sessionId);   // server forgets
res.clearCookie("sid", ...);      // browser forgets
```

The **first line is the real logout**. The second is only tidying up. If you only cleared the cookie, anyone who had copied it could keep using it until it expired.

## 6. Status codes

| Situation | Code |
|---|---|
| Not logged in / session expired | `401 Unauthorized` (really means "unauthenticated": I don't know who you are) |
| Logged in but not allowed (topic 09) | `403 Forbidden` (I know who you are, and the answer is no) |

## 7. Where to keep sessions, and which tool

| Option | When | Downside |
|---|---|---|
| In-memory `Map` (this example) | Learning, quick demos | Lost on restart. Breaks with 2+ servers: server A made the session, server B has never heard of it. Grows forever if you never clean up. |
| **Redis** | The usual choice in production | One more service to run. Very fast, and has built-in expiry. |
| Database table (Postgres etc.) | Small apps, already have a DB | A DB read on every request |

| Library | When |
|---|---|
| Hand-written (this example) | To understand it |
| `express-session` + a store (`connect-redis`, `connect-pg-simple`) | Normal Express apps |
| Auth libraries (Auth.js, Clerk, Supabase Auth) | When you'd rather not own auth yourself. Underneath they do exactly this, or JWTs. |

### Sessions vs JWT (next topic, in one line)

- **Session**: the cloakroom ticket. Truth lives on the server. Easy to revoke (delete the row). Costs a lookup per request.
- **JWT**: a signed ID card. Truth is **inside** the token. No lookup, but hard to cancel before it expires.

## 8. Attacks and the defence for each

| Attack | What happens | Defence |
|---|---|---|
| **Cookie theft by XSS** | Attacker gets a script into your page, it reads `document.cookie` and sends it home | `HttpOnly` |
| **Sniffing** | Someone on the same Wi-Fi reads the traffic | HTTPS + `Secure` |
| **CSRF** (cross-site request forgery) | You're logged in to `bank.com`. You visit `evil.com`, which has a hidden form that POSTs to `bank.com/transfer`. The browser **attaches your bank cookie automatically**. | `SameSite=Lax` (or `Strict`). For big apps, also CSRF tokens. |
| **Session fixation** | Attacker gets *their* session id into your browser before you log in. You log in, the server upgrades that same id to "you". Attacker uses the id they already knew. | New random id on every login (our `delete` + `createSession`) |
| **Guessing ids** | Try `sid=1`, `sid=2`... | Long random ids from `crypto.randomBytes` |
| **Stolen cookie used forever** | A copied cookie keeps working | Server-side expiry, real logout that deletes the session |

The pattern: the cookie **is** your login. Anything that gets the cookie gets the account. Every defence above is about keeping the ticket safe or making a stolen one useless.

## 9. Real-world

- Open devtools on a site you're logged in to → Application (Chrome) / Storage (Firefox) → Cookies. You'll see long random values with `HttpOnly` ticked. That's this exact pattern.
- GitHub uses a session cookie called `user_session`. Rails apps, Django apps and most PHP apps use server sessions by default.
- "Log out of all devices" buttons = delete every session row with your `userId`. Easy with sessions, hard with JWTs.
- Changing your password should also delete your other sessions, so a thief gets kicked out.

## 10. Try it

```bash
cd 03-backend-core/07-sessions-cookies
node example.js
```

In a second terminal. `jar.txt` is curl's pretend cookie storage.

| Command | Result |
|---|---|
| `curl localhost:3000/api/me` | 401, Please log in. No cookie, so a stranger. |
| `curl localhost:3000/api/signup -H 'Content-Type: application/json' -d '{"email":"asha@example.com","password":"123456789"}'` | 201 |
| `curl -i -c jar.txt localhost:3000/api/login -H 'Content-Type: application/json' -d '{"email":"asha@example.com","password":"123456789"}'` | 200, and look for the `Set-Cookie: sid=...; HttpOnly; SameSite=Lax` header |
| `cat jar.txt` | curl saved the cookie, like a browser would |
| `curl -b jar.txt localhost:3000/api/me` | 200, your email. The server remembered you. |
| `curl localhost:3000/debug/sessions` | the server's side: the same id, mapped to userId 1 |
| `curl -b 'sid=1' localhost:3000/api/me` | 401. Guessing doesn't work. |
| `curl -b 'sid=PASTE_THE_REAL_ID' localhost:3000/api/me` | 200. Whoever has the id **is** you. |
| `curl -i -b jar.txt -c jar.txt -X POST localhost:3000/api/logout` | 200, and `Set-Cookie: sid=; Expires=1970...` (that's how you delete a cookie) |
| `curl localhost:3000/debug/sessions` | `{}`, the server forgot |
| repeat the `sid=PASTE_THE_REAL_ID` command | 401. The stolen copy is dead too. |
| stop the server (Ctrl+C), start it, log in again, then restart once more and call `/api/me` | 401. In-memory sessions die with the server. |

Afterwards: `rm jar.txt`.

## 11. Common mistakes

| Mistake | What happens |
|---|---|
| `userId=1` (or the email) in a plain cookie | Anyone edits it and becomes someone else |
| Session id from a counter or `Math.random()` | Guessable |
| Forgetting `HttpOnly` | One XSS bug and every visitor's login is stolen |
| Forgetting `Secure` in production | Cookie readable on public Wi-Fi |
| Logout only clears the cookie | Copied cookies keep working |
| Trusting the cookie's `Max-Age` for expiry | Stolen copies ignore it. Check expiry on the server. |
| Keeping the same session id after login | Session fixation |
| In-memory store in production | Everyone logged out on every deploy, broken with more than one server |
| Putting lots of data in the cookie | Cookies max out around 4KB and travel with every request. Keep only the id. |

## 12. Check yourself

<details>
<summary>1. What's the difference between a cookie and a session?</summary>

The cookie is the small piece of text the browser stores and sends back automatically (the ticket in your pocket). The session is the record on the server that says who that ticket belongs to (the coat on the hook).
</details>

<details>
<summary>2. Why can't you just store <code>userId=5</code> in the cookie?</summary>

The user controls their cookies and can change it to `userId=6`. A random session id means nothing on its own; only the server knows who it belongs to.
</details>

<details>
<summary>3. You restart <code>node example.js</code>. What happens to everyone who was logged in, and why?</summary>

They're all logged out. Their browsers still send the old `sid`, but the sessions `Map` lived in memory and is now empty, so the lookup fails and they get 401.
</details>

<details>
<summary>4. Logout only did <code>res.clearCookie("sid")</code>. What could go wrong?</summary>

The session still exists on the server. Anyone who copied the cookie earlier (a thief, a shared computer's saved jar) can keep using it until it expires.
</details>

<details>
<summary>5. Which cookie setting stops a script injected into your page from stealing the session? Which one stops another website from POSTing as you?</summary>

`HttpOnly` stops scripts reading it. `SameSite=Lax` stops it being sent on POSTs from other sites (CSRF).
</details>

<details>
<summary>6. The cookie has <code>Max-Age=3600</code>. Why does the server also store <code>expiresAt</code>?</summary>

`Max-Age` is only an instruction to a well-behaved browser. Someone who copied the id into curl can send it forever. The server's own expiry check is the one that can't be ignored.
</details>

<details>
<summary>7. You run 3 copies of the server behind a load balancer, with the in-memory Map. Users say they get randomly logged out. Why?</summary>

Each copy has its own Map. Login happened on server A; the next request lands on server B, which has never seen that session id. Fix: a shared store like Redis.
</details>
