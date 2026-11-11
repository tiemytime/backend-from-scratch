# 02. How the Web Works + HTTP

Each idea is written twice:
- **In plain words** for the intuition
- **Technically** for the real terms

Best way to learn this: run `curl -v` on real sites and read every line.

---

## 1. What happens when you open a website

The whole thing is like **making a phone call**:

| Stage | Phone call | Technically |
|---|---|---|
| 1 | Look up the number | **DNS**: turn a name into an IP address |
| 2 | Dial | **TCP**: open a connection |
| 3 | Check ID, agree on a secret language | **TLS**: verify certificate, set up encryption |
| 4 | Ask your question | **HTTP request** |
| 5 | Get the answer | **HTTP response** |

```bash
curl -v https://google.com
```

### Reading `curl -v` output

| Symbol | Meaning |
|---|---|
| `*` | curl's notes to you ("here's what I'm doing") |
| `>` | what **you sent** |
| `<` | what the **server sent back** |

---

## 2. Stage 1: DNS (the phonebook)

```
* Host google.com:443 was resolved.
* IPv6: 2404:6800:...
* IPv4: 192.178.158.101, 192.178.158.102, ...
```

**In plain words:** computers don't understand names like "google.com". They need a number. DNS is the internet's phonebook.

**Technically:**
- **IP address** = a machine's address on the network
  - **IPv4**: old, short (`192.178.158.101`)
  - **IPv6**: new, long (`2404:6800:...`), made because the world ran out of IPv4
- Big sites return **many** IPs (many servers)
- **Port** = a room number inside the building. `:443` = HTTPS, `:80` = plain HTTP

---

## 3. Stage 2: TCP (dialing)

```
*   Trying 192.178.158.101:443...
* Established connection to google.com (192.178.158.100 port 443) from 10.35.74.76 port 56584
```

**In plain words:** curl dialed several numbers at once and used whichever answered first.

**Technically:** a TCP connection is a reliable two-way pipe for bytes. The `from ... port 56584` part is **your** side: your laptop's IP and a random temporary port.

---

## 4. Stage 3: TLS (the "S" in HTTPS)

```
* TLSv1.3 (OUT), TLS handshake, Client hello (1):
* TLSv1.3 (IN), TLS handshake, Server hello (2):
* TLSv1.3 (IN), TLS handshake, Certificate (11):
*   subject: CN=*.google.com
*   issuer: C=US; O=Google Trust Services; CN=WE2
* SSL certificate verified via OpenSSL.
* ALPN: server accepted h2
```

**In plain words:** before talking, both sides:
1. **Check ID.** The server shows a **certificate** (an ID card: "I really am google.com"), signed by a trusted authority. Your computer checks it against its list of trusted authorities. This stops someone on your Wi-Fi from pretending to be Google.
2. **Agree on a secret language.** They create a shared key, so everything after is scrambled for anyone listening.

**Technically:**
- **Certificate**: proves identity; signed by a **Certificate Authority (CA)**
- Trusted CAs live in `/etc/ssl/certs/` on Linux
- **ALPN** picks the HTTP version. `h2` = HTTP/2

---

## 5. Stage 4: The HTTP request

```
> GET / HTTP/2
> Host: google.com
> User-Agent: curl/8.22.0
> Accept: */*
```

**In plain words:** HTTP is surprisingly simple. It's almost plain English text.

| Line | Meaning |
|---|---|
| `GET /` | "Please give me the main page." `GET` = the **method**, `/` = the **path** |
| `Host: google.com` | Which website (one server can host many) |
| `User-Agent: curl/...` | "I'm curl" (a browser says "I'm Chrome") |
| `Accept: */*` | "I'll accept any type of content" |

The `Name: value` lines are **headers**: extra info attached to the request.

**A request =** method + path + headers + (optional) body

---

## 6. Stage 5: The HTTP response

```
< HTTP/2 301
< location: https://www.google.com/
< cache-control: public, max-age=2592000
< server: gws
< content-length: 220
<
<H1>301 Moved</H1>
```

**Surprise:** Google didn't send the homepage. `301` = **"Moved permanently, go here instead"**, and `location:` says where (`www.google.com`). Browsers follow this automatically; curl doesn't unless you add `-L`.

| Header | Meaning |
|---|---|
| `cache-control: max-age=2592000` | "You can remember this for 30 days" |
| `server: gws` | Software that answered (Google Web Server) |
| `content-length: 220` | Body is 220 bytes |

**A response =** status code + headers + (optional) body

### One-line summary
**DNS (find) → TCP (dial) → TLS (ID + encrypt) → request (ask) → response (answer).**
This happens every time you open any website.

### Useful curl flags

```bash
curl -v URL                 # show everything
curl -vL URL                # follow redirects like a browser
curl -I URL                 # only response headers
curl -X POST URL -d "a=b"   # choose method, send data
curl -H "Name: value" URL   # add a header
```

---

## 7. Status codes

**Families:**

| Range | In plain words |
|---|---|
| 1xx | "Hold on" (info) |
| 2xx | 👍 "Here you go" |
| 3xx | 👉 "Go over there" |
| 4xx | 🫵 "**You** messed up" (client error) |
| 5xx | 🔥 "**I** messed up" (server error) |

**The ~12 you'll actually use:**

| Code | Name | In plain words | When a backend sends it |
|---|---|---|---|
| 200 | OK | Here you go | Normal success |
| 201 | Created | Done, I made it | After creating something |
| 204 | No Content | Done, nothing to show | After deleting |
| 301 | Moved Permanently | Lives elsewhere now, forever | Old URL → new URL |
| 302 | Found | Go there for now | After login → dashboard |
| 304 | Not Modified | You already have the latest copy | Caching |
| 400 | Bad Request | Your request makes no sense | Missing / wrong fields |
| 401 | Unauthorized | Who are you? Log in first | No login / expired token |
| 403 | Forbidden | I know you, but you're not allowed | Normal user on admin page |
| 404 | Not Found | Doesn't exist | Wrong URL, deleted item |
| 429 | Too Many Requests | Slow down | Rate limiting |
| 500 | Internal Server Error | My code crashed | Bug in the backend |
| 502 / 503 | Bad Gateway / Unavailable | Server behind me is down / overloaded | Deploys, crashes, traffic spikes |

### 401 vs 403 (common interview question)
- **401:** security guard says "**show me your ID**." You haven't proven who you are.
- **403:** guard says "**I see your ID, but you're not on the list.**"

### Practice answers (example: a notes app)
| Situation | Code |
|---|---|
| Required field left empty | 400 (or 422) |
| User edits someone else's note | 403 (or 404 to hide that it exists, like GitHub private repos) |
| New note created | 201 |
| Database throws unexpected error | 500 |

---

## 8. HTTP methods (the verbs)

**In plain words:** the status code is the server's **answer**. The method is the **type of question**.

| Method | In plain words | Example (notes app) |
|---|---|---|
| GET | **Show** me (changes nothing) | Open a note, list notes |
| POST | **Create** something new | Create a note |
| PUT | **Replace** this completely | Overwrite a whole note |
| PATCH | **Change a part** of this | Rename just the title |
| DELETE | **Remove** this | Delete a note |

**Rule of thumb:** new thing → POST. Change part of an existing thing → PATCH.

### URL + method = REST

The **URL** says **what thing**. The **method** says **what to do**.

```
GET    /notes        → list all notes
POST   /notes        → create a note
GET    /notes/42     → show note 42
PATCH  /notes/42     → edit part of note 42
DELETE /notes/42     → delete note 42
```

### Safe
**GET should never change anything.** Browsers, caches and search-engine crawlers call GET freely. If "delete" used GET, a crawler could delete your data just by visiting links. (This has really happened.)

### Idempotent
**In plain words:** "doing it twice = same result as doing it once."

| Method | Twice in a row | Idempotent? |
|---|---|---|
| GET | same data | ✅ |
| PUT | same final state | ✅ |
| DELETE | still deleted | ✅ |
| POST | **two** things created | ❌ |

That's why "Pay" buttons get disabled after one click.

**Real fix:** an **idempotency key**. The client sends a unique ID with the request; the server says "already saw this ID, won't do it again." Stripe uses this for payments.

Try it:

```bash
curl https://httpbin.org/get
curl -X POST https://httpbin.org/post -d "name=me"
curl -X DELETE https://httpbin.org/delete
```

---

## 9. Headers

**In plain words:** extra notes attached to a request or response.

| Header | Direction | In plain words |
|---|---|---|
| `Content-Type` | both | What kind of data this is (JSON, HTML, image) |
| `Authorization` | request | My login proof (usually a token) |
| `Cookie` / `Set-Cookie` | both | The wristband (see below) |
| `Cache-Control` | response | How long you can remember this answer |
| `Location` | response | Go here instead (with 3xx) |
| `Access-Control-Allow-Origin` | response | **CORS**: which other websites may call me. Source of the famous "CORS error". |

```bash
curl https://httpbin.org/headers -H "Authorization: Bearer mysecret123"
```

---

## 10. Cookies and login

```bash
curl -v 'https://httpbin.org/cookies/set?user=me'
```

```
< set-cookie: user=me; Secure; Path=/
```

| Part | In plain words |
|---|---|
| `set-cookie:` | "Save this and bring it back every time you visit me" |
| `user=me` | The data: name = value |
| `Secure` | Only send it over HTTPS |
| `Path=/` | Send it for every page on this site |

No expiry date = **session cookie** (gone when the browser closes).

### HTTP has no memory (stateless)

**In plain words:** every request is a stranger to the server. Cookies are the wristband that makes the server "remember" you.

```
1. You:     POST /login   (email + password)
2. Server:  password OK ✅
            Set-Cookie: session=abc123xyz; HttpOnly; Secure
3. You:     GET /dashboard
            Cookie: session=abc123xyz     ← browser adds this automatically
4. Server:  "abc123xyz? That's you." → shows your dashboard
```

### Cookie flags real apps should use

| Flag | Protects against |
|---|---|
| `HttpOnly` | JavaScript can't read it → injected scripts (**XSS**) can't steal your login |
| `SameSite=Lax` | Other sites can't secretly make requests with your cookie (**CSRF**) |
| `Max-Age=3600` / `Expires=...` | When the cookie dies |

---

## 11. Build an HTTP server from scratch (no framework)

Goal: see that HTTP is **just text over a TCP connection**. Express, Next.js etc. do this under the hood.

Code: [`server.js`](./server.js)

### Step 1: A server that only listens

```js
const net = require("net");

const server = net.createServer((socket) => {
  console.log("Someone connected!");

  socket.on("data", (data) => {
    console.log("---- They sent: ----");
    console.log(data.toString());
  });
});

server.listen(3000, () => {
  console.log("Listening on port 3000");
});
```

| Code | In plain words |
|---|---|
| `require("net")` | Load Node's raw connection tool (TCP). No HTTP, just a pipe for bytes. |
| `net.createServer((socket) => ...)` | "When someone connects, run this." `socket` = the phone line to that person. |
| `socket.on("data", ...)` | "When bytes arrive on this line, run this." |
| `data.toString()` | Raw bytes → readable text |
| `server.listen(3000)` | Open door number 3000 (the port) and wait |

Run:

```bash
node server.js                  # terminal 1
curl http://localhost:3000      # terminal 2 (localhost = my own computer)
```

Terminal 1 prints:

```
Listening on port 3000
Someone connected!
---- They sent: ----
GET / HTTP/1.1
Host: localhost:3000
User-Agent: curl/8.22.0
Accept: */*
```

**That's a raw HTTP request.** Plain text. (HTTP/1.1, not HTTP/2, because there's no HTTPS here.)

**curl hangs. Why?** The server received the request but **never answered**. Like picking up a call and staying silent.

### Lessons from mistakes along the way
- `Could not connect to server` → **nobody is listening on that port.** Usually: the server isn't running.
- `node server.js` exits instantly with no output → the file was empty (not saved).
- `SyntaxError: Unexpected token '~'` → non-JS text (shell commands) got pasted into the file.
- Code changes only apply after restarting the server (Ctrl+C, then `node server.js`).

### Step 2: Send a reply

Add these lines inside `socket.on("data", ...)`, right after the `console.log`:

```js
    socket.write("HTTP/1.1 200 OK\r\n");
    socket.write("\r\n");
    socket.write("Hello from lipakshi's server\n");
    socket.end();
```

| Code | In plain words |
|---|---|
| `HTTP/1.1 200 OK` | Status line: "I understood you, all good." |
| `\r\n` alone | Empty line = "headers are done, body starts now" |
| `Hello from...` | The body. What you actually see. |
| `socket.end()` | Hang up |

`\r\n` = HTTP's "new line". Every line in a request or response ends with it.

**A response has the same shape as a request:** first line, headers, empty line, body.

Now `curl` prints the text and exits, and opening `http://localhost:3000` in a browser shows it too.

**Missing `Content-Type`?** It still worked because the browser *guessed* the type. Real servers always say it, e.g. `Content-Type: text/plain`.

### What a browser sends (vs curl)

Opening the page in Firefox sends a much bigger request:

| Header | In plain words |
|---|---|
| `User-Agent` | "I'm Firefox on Linux" |
| `Accept` | "I prefer HTML, but anything (`*/*`) is fine" |
| `Accept-Encoding: gzip, ...` | "You can compress the reply" |
| `Connection: keep-alive` | "Keep this line open for more requests" |
| `Cookie` | **Every cookie saved for `localhost`** |

**Cookie lesson:** cookies belong to the **host name, not the port**. `localhost:3000` and `localhost:5173` share cookies. So any app you run on localhost receives login tokens from every other localhost project. Never paste the `Cookie:` line anywhere public.

### Step 3: Different pages for different paths
*Coming next.*

---

## Resources
- MDN "An overview of HTTP" (free, very good)
- Julia Evans' zines: "HTTP: Learn your browser's language", "Networking! ACK!" (wizardzines.com)
- Hussein Nasser (YouTube): networking + backend fundamentals
- httpbin.org: free server that echoes back your requests, for practice
