# JWT (JSON Web Tokens)

[← Sessions and cookies](../07-sessions-cookies/) · [Backend core](../)

## 1. The problem

Sessions work, but the server has to **keep a table** and look it up on every request:

- every request = one lookup in Redis or the database
- 3 servers? They all need to share that table
- a separate service (say, a payments API) wants to know who the user is? It has to ask the session store too

**Question: could the user carry proof of who they are, so the server doesn't need to remember anything?**

That's a JWT (say it "jot").

## 2. In plain words: the festival wristband

At a music festival, the gate checks your ticket once and puts a **wristband** on you. It says `VIP · Day 2`, and it has a **hologram seal** that only the festival's machine can make.

- After that, every stage just **looks at the wristband**. Nobody phones the gate to ask "is this person allowed?"
- Anyone can **read** what's printed on it. It's not a secret.
- If you scribble `Day 3` on it, the hologram no longer matches. Rejected.
- It has a date on it. After Day 2, it's useless.
- **The catch:** if you get thrown out at lunch, your wristband still says `VIP · Day 2`. Every stage will still let you in until it runs out.

| Festival | Web |
|---|---|
| Ticket check at the gate | Login (bcrypt) |
| Wristband | The JWT |
| Printed text | The **payload**: user id, email, expiry |
| Hologram seal | The **signature** |
| The festival's hologram machine | The server's **secret key** |
| Stages checking the band | Routes running `jwt.verify` |

Compared with the cloakroom ticket from topic 07:

| | Session (cloakroom ticket) | JWT (wristband) |
|---|---|---|
| What the user holds | A random number, means nothing alone | The actual info, plus a seal |
| Where the truth lives | Server's table | **Inside the token** |
| Server lookup per request | Yes | **No**, just check the seal |
| Log someone out right now | Easy: delete the row | **Hard**: the band is still valid |

## 3. What a JWT looks like

Run the demo:

```bash
node jwt-by-hand.js
```

A JWT is three pieces of text joined by dots:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoi....JzGWRHgALWPE8f7s...
└──────────── header ──────────────┘ └────── payload ───────┘ └── signature ──┘
```

| Part | What it is | Decoded |
|---|---|---|
| Header | Which algorithm signed it | `{ "alg": "HS256", "typ": "JWT" }` |
| Payload | The claims: who, until when | `{ "sub": 1, "email": "asha@example.com", "exp": 1794485317 }` |
| Signature | The hologram | random-looking bytes |

The first two parts are just JSON turned into **base64url** text. Base64 is **not encryption**, it's just a way of writing bytes as safe letters. Anyone can turn it back. Paste any JWT into [jwt.io](https://jwt.io) and you'll see the payload.

> **Never put anything secret in a JWT payload.** No passwords, no hashes, no card numbers. Treat it like a postcard.

### Standard payload names

| Claim | Means |
|---|---|
| `sub` | **subject**: who this is about (the user id) |
| `exp` | **expires**: Unix time in seconds |
| `iat` | **issued at** |
| `iss`, `aud` | who issued it, who it's for (used when several services are involved) |

## 4. The signature, underneath

```
signature = HMAC-SHA256( header + "." + payload,  SECRET )
```

**HMAC** is a hash (topic 06's smoothie) that also mixes in a **secret key**. Only someone who knows the secret can produce the right signature for a given payload.

To verify, the server does the same calculation and compares:

```
recalculate HMAC(header.payload, SECRET)
  → same as the signature on the token?   ✅ nobody changed it, and we made it
  → different?                             ❌ tampered or forged
  → then: is exp in the past?              ❌ expired
```

Step 4 of the demo changes `sub: 1` to `sub: 2`. The attacker can edit the payload easily, but they can't make a matching signature without the secret. **Rejected.**

So:

- **Reading** a JWT needs nothing.
- **Making** or **changing** a valid one needs the secret.
- If the secret leaks, the attacker can mint a token for **any** user. Guard it like the database password (topic 05).

## 5. The code

```bash
JWT_SECRET=dev-secret-change-me node example.js
```

Without `JWT_SECRET` it refuses to start. That's the fail-fast idea from topic 05.

### Login: make the wristband

```js
const token = jwt.sign({ sub: String(user.id), email: user.email }, JWT_SECRET, {
  algorithm: "HS256",
  expiresIn: "15m",
});
res.json({ token });
```

`jwt.sign` does what `makeToken` did by hand: builds the header and payload, adds `iat` and `exp`, signs it. Notice there's **no `sessions.set`**. The server stores nothing.

### Sending it back: the `Authorization` header

Cookies get sent automatically. A token in a JSON response doesn't. The client must attach it **itself** on every request:

```
GET /api/me
Authorization: Bearer eyJhbGciOi...
```

`Bearer` means "whoever **bears** (carries) this is allowed". Same lesson as cookies: holding it is enough.

### Checking it

```js
const [scheme, token] = header.split(" ");
if (scheme !== "Bearer" || !token) return res.status(401)...

const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
req.user = { id: payload.sub, email: payload.email };
```

`jwt.verify` checks the signature **and** `exp`. If either fails it **throws**, so it's wrapped in `try/catch` and turned into a 401.

`algorithms: ["HS256"]` means "only accept the algorithm I actually use". Older libraries could be tricked by a token whose header said `"alg": "none"` (no signature at all). Pinning the algorithm closes that door.

Compare with topic 07: there, `loadUser` looked the session up in a `Map`. Here **nothing is looked up**. The token is self-contained.

### Logout

```js
app.post("/api/logout", (req, res) => {
  res.json({ message: "Throw the token away on your side. The server can't cancel it." });
});
```

That's not laziness. With plain JWTs **there's nothing on the server to delete**. Try it in section 9: after logout, the old token still works.

## 6. The big catch: you can't take it back

Asha's laptop is stolen. She clicks "log out everywhere". With sessions: delete her rows, done. With JWTs: every token already handed out stays valid until `exp`.

How real apps deal with it:

| Fix | How | Trade-off |
|---|---|---|
| **Short expiry** | Tokens last 5 to 15 minutes | Stolen ones die fast. But users would have to log in constantly, so... |
| **Refresh token** | Login gives two things: a short **access token** (JWT, 15 min) and a long **refresh token** (days, stored on the server like a session). When the access token expires, the client trades the refresh token for a new one. | Logout = delete the refresh token. The thief has 15 minutes at most. This is what most real apps do. |
| **Denylist** | Keep a list of cancelled token ids, check it on every request | Now you have a lookup per request again, the thing JWTs were meant to avoid |
| **Token version on the user** | Put `tokenVersion: 3` in the token; bump it to 4 on "log out everywhere"; reject older ones | Needs a user lookup per request |

Notice: every fix brings back some server-side state. **There is no free lunch.**

## 7. Where the client keeps the token

| Place | Risk |
|---|---|
| `localStorage` | Easy, but any script on the page can read it. One XSS bug = token stolen. |
| Memory (a JS variable) | Gone on page refresh. Usually paired with a refresh token in a cookie. |
| **`HttpOnly` cookie** | Scripts can't read it (topic 07). But now it's sent automatically, so you need `SameSite` against CSRF again. |
| Mobile app secure storage | The normal choice for mobile apps, which don't have cookies the way browsers do |

So a JWT doesn't **have** to go in the `Authorization` header. It can live in a cookie too. "JWT vs session" is about **what's in the ticket**, not about how it travels.

## 8. When to pick which

| Situation | Pick |
|---|---|
| One normal web app with its own backend | **Sessions.** Simpler, instant logout. |
| Mobile app talking to an API | JWT access + refresh tokens (common), or sessions with a token in the header (also fine) |
| Many separate services must trust the same login | **JWT.** Each service checks the signature without calling a central store. |
| Signing in with Google, Supabase, Clerk, Firebase | You'll **receive** JWTs from them. You verify, they issue. |
| Not sure | Sessions |

People often pick JWTs because they sound modern. For a simple app they mostly add problems (section 6). Pick them when you actually need the "no lookup" or "many services" part.

### HS256 vs RS256 (one paragraph)

**HS256** uses **one secret** to both sign and verify, so every service that verifies could also forge. **RS256** uses a **key pair**: a private key signs (only the login server has it), a public key verifies (anyone can have it). That's why Google, Supabase and Clerk use RS256-style keys: your server can check their tokens without being able to make them.

## 9. Try it

```bash
cd 03-backend-core/08-jwt
node jwt-by-hand.js                            # the idea, no libraries
JWT_SECRET=dev-secret-change-me node example.js
```

In a second terminal:

| Command | Result |
|---|---|
| `curl localhost:3000/api/me` | 401, no token |
| `curl localhost:3000/api/signup -H 'Content-Type: application/json' -d '{"email":"asha@example.com","password":"123456789"}'` | 201 |
| `curl localhost:3000/api/login -H 'Content-Type: application/json' -d '{"email":"asha@example.com","password":"123456789"}'` | `{"token":"eyJ..."}`. Copy the token. |
| `TOKEN=paste_it_here` | saves it in your terminal so you don't keep pasting |
| `curl localhost:3000/api/me -H "Authorization: Bearer $TOKEN"` | 200, your id and email |
| paste the token into jwt.io | you can read the payload without any secret |
| `curl localhost:3000/api/me -H "Authorization: Bearer ${TOKEN}x"` | 401, Invalid token (one extra letter breaks the signature) |
| `curl -X POST localhost:3000/api/logout` then the `/api/me` command again | **still 200**. The catch from section 6. |
| restart the server with the **same** secret, call `/api/me` | still 200. No sessions to lose. (Signup is gone though, users is in memory.) |
| restart with `JWT_SECRET=a-different-one`, call `/api/me` | 401. Changing the secret kills every token at once. |
| restart with `TOKEN_TTL=10s`, log in, wait 10 seconds, call `/api/me` | 401, Token expired |

## 10. Common mistakes

| Mistake | What happens |
|---|---|
| Putting secrets in the payload | Anyone can read it. It's a postcard. |
| `jwt.decode` instead of `jwt.verify` | `decode` only reads, it **doesn't check the signature**. Anyone can forge a token. |
| Weak secret like `"secret"` | Attackers guess it offline, then mint tokens for any user. Use 32+ random bytes. |
| Secret written in the code | It ends up on GitHub. Use env vars (topic 05). |
| Not pinning `algorithms` | Opens the door to "alg confusion" tricks |
| Tokens that last days or weeks | A stolen one works for days, and you can't cancel it |
| Thinking logout cancels the token | It doesn't, unless you add refresh tokens or a denylist |
| Putting role/permissions in the token and changing them later | The old token still says `admin` until it expires |
| Using JWTs "because they scale" for a small app | Extra problems, no real gain |

## 11. Check yourself

<details>
<summary>1. Can anyone read what's inside a JWT? Can anyone change it?</summary>

Anyone can read it: the payload is only base64, not encrypted. Nobody can change it **without the server noticing**, because the signature would no longer match, and making a new signature needs the secret.
</details>

<details>
<summary>2. With sessions, <code>/api/me</code> looked something up. With JWTs it doesn't. How does the server know who you are?</summary>

The token itself contains `sub` (the user id). The server checks the signature to prove it made that token and nobody changed it, then trusts what's written inside.
</details>

<details>
<summary>3. Asha logs out, but a thief copied her token 5 minutes earlier. Sessions vs JWT: what happens in each case?</summary>

Sessions: logout deletes the server-side row, so the thief's copy stops working right away. JWT: there's nothing to delete, so the thief's copy keeps working until `exp`. That's why access tokens are kept short.
</details>

<details>
<summary>4. What's the difference between <code>jwt.decode</code> and <code>jwt.verify</code>, and why does it matter?</summary>

`decode` just reads the payload. `verify` also checks the signature and expiry. Using `decode` for auth means an attacker can write `"sub": "1"` themselves and become user 1.
</details>

<details>
<summary>5. Your <code>JWT_SECRET</code> gets pushed to a public GitHub repo. What can an attacker do, and what's the fix?</summary>

They can sign their own tokens for any user, including admins. Fix: change the secret immediately. Every existing token becomes invalid (everyone has to log in again), including the attacker's forged ones.
</details>

<details>
<summary>6. You put <code>role: "admin"</code> in the token. You remove Ravi's admin rights. When does he actually lose admin access?</summary>

Only when his current token expires and he gets a new one. Until then his token still says admin. Short expiry, or checking the role in the database for sensitive actions, fixes this.
</details>

<details>
<summary>7. You're building a simple blog with one Express backend. Sessions or JWT?</summary>

Sessions. Simpler, and logout works instantly. JWTs are worth it when several separate services must check logins without a shared store, or when you receive tokens from a provider like Google or Supabase.
</details>
