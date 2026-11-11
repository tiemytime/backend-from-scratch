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

The path lives in the request's first line: `GET /about HTTP/1.1`. Cut it at the spaces to get it.

```js
const firstLine = request.split("\r\n")[0];
const [method, path] = firstLine.split(" ");

if (path === "/") {
  body = "Home page\n";
} else if (path === "/about") {
  body = "About: this server is built from scratch\n";
} else {
  status = "404 Not Found";
  body = "Nothing here\n";
}
```

| Code | In plain words |
|---|---|
| `split("\r\n")[0]` | Cut request into lines, keep the first |
| `split(" ")` | Cut `GET /about HTTP/1.1` into 3 pieces |
| `const [method, path]` | Name the first two pieces |
| `if / else` | Pick the reply based on the path. This is **routing**. |
| `404 Not Found` | "That page doesn't exist" |

Try it (`-i` shows status line + headers):

```bash
curl -i localhost:3000/          # 200 OK, Home page
curl -i localhost:3000/about     # 200 OK, About...
curl -i localhost:3000/banana    # 404 Not Found
```

**This is all Express does underneath** `app.get("/about", ...)`: read the first line, compare the path, write a reply.

### Step 4: Send JSON

Apps talk to servers in **JSON**, text that code can read. Add a route that returns a list:

```js
const notes = [
  { id: 1, text: "Learn HTTP" },
  { id: 2, text: "Build a server" },
];

// inside the if/else:
} else if (path === "/api/notes") {
  contentType = "application/json";
  body = JSON.stringify(notes);
}

// when replying:
socket.write("Content-Type: " + contentType + "\r\n");
socket.write("Content-Length: " + Buffer.byteLength(body) + "\r\n");
```

| Code | In plain words |
|---|---|
| `notes` | A list kept in memory. A pretend database (gone when the server restarts). |
| `JSON.stringify(notes)` | JS list → JSON text that can travel over the wire |
| `Content-Type: application/json` | "This body is JSON, not plain text" |
| `Content-Length` | "The body is exactly N **bytes**", so the client knows when it ends |
| `Buffer.byteLength(body)` | Count bytes, not letters (an emoji = 1 letter, 4 bytes) |

```
$ curl -i localhost:3000/api/notes
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 63

[{"id":1,"text":"Learn HTTP"},{"id":2,"text":"Build a server"}]%
```

- `Home page\n` has Content-Length 10: 9 visible characters + the invisible `\n`.
- **That `%` at the end** is zsh saying "this output didn't end with a new line". `JSON.stringify` doesn't add `\n`. Not an error; JSON doesn't need one.
- Open `/api/notes` in Firefox: it detects the JSON and shows a viewer.

### Step 5: Receive data (POST)

A `POST` request **carries a body**, after the empty line, just like a response:

```
POST /api/notes HTTP/1.1
Host: localhost:3000
Content-Type: application/x-www-form-urlencoded

{"text":"Buy milk"}
```

```js
const [head, requestBody] = request.split("\r\n\r\n");

} else if (method === "POST" && path === "/api/notes") {
  contentType = "application/json";
  try {
    const input = JSON.parse(requestBody);
    const note = { id: notes.length + 1, text: input.text };
    notes.push(note);
    status = "201 Created";
    body = JSON.stringify(note);
  } catch (err) {
    status = "400 Bad Request";
    body = JSON.stringify({ error: "Body must be valid JSON" });
  }
}
```

| Code | In plain words |
|---|---|
| `split("\r\n\r\n")` | Cut at the empty line: head on the left, body on the right |
| `method === "POST" && path === ...` | Same path, different job depending on the method |
| `JSON.parse` | JSON text → JS object (opposite of `stringify`) |
| `notes.push(note)` | Add to the end of the list |
| `201 Created` | "Done, I made a new thing" |
| `try / catch` | "Try this; if it crashes, do the catch part instead of dying" |
| `400 Bad Request` | "You sent something broken" (client's fault) |

```bash
curl -i localhost:3000/api/notes -d '{"text":"Buy milk"}'   # 201, {"id":3,...}
curl -i localhost:3000/api/notes                            # now 3 notes
curl -i localhost:3000/api/notes -d 'oops not json'         # 400
```

`-d '...'` = send this as the body. curl switches to POST by itself.

- curl `-d` labels the body `application/x-www-form-urlencoded` (form data) by default. Our server ignores that label. To be correct, add `-H "Content-Type: application/json"`.
- `curl: option -d: requires parameter` → `-d` with nothing after it.
- **Restart the server and "Buy milk" is gone.** `notes` lives in memory (RAM), which is wiped when the program stops. Keeping data needs a file or a database.

### Step 6: Keep data after restart

Memory (RAM) is a whiteboard: wiped when the server stops. A file is a notebook: it stays.

- **On start:** read `notes.json` to get the notes back.
- **On every new note:** write the whole list to `notes.json` again.

```js
const fs = require("fs");
const FILE = __dirname + "/notes.json";

function loadNotes() {
  if (!fs.existsSync(FILE)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function saveNotes() {
  fs.writeFileSync(FILE, JSON.stringify(notes, null, 2));
}

const notes = loadNotes();

// in the POST route, after notes.push(note):
saveNotes();
```

| Code | In plain words |
|---|---|
| `require("fs")` | Node's file tool (file system) |
| `__dirname + "/notes.json"` | The file next to server.js, wherever you run it from |
| `fs.existsSync` | "Does the file exist yet?" First run: no, so start with `[]` |
| `fs.readFileSync(FILE, "utf8")` | Read the file as text |
| `fs.writeFileSync` | Replace the whole file with new text |
| `JSON.stringify(notes, null, 2)` | JSON, indented 2 spaces so humans can read it |
| `function name() { }` | A named, reusable block of code |

Test: POST a note, `cat notes.json`, **Ctrl+C and restart the server**, GET again. The note is still there.

`notes.json` is in `.gitignore`: it's data, not code.

**Why this isn't a real database (yet):**
- Every save rewrites the **whole** file. Fine for 10 notes, slow for a million.
- Two requests saving at the same moment can overwrite each other.
- If the server crashes mid-write, the file can be left half-written and broken.
- `id: notes.length + 1` breaks once deleting exists (delete id 1, next note gets a duplicate id).

Databases (SQLite, Postgres) solve exactly these problems.

---

## Resources
- MDN "An overview of HTTP" (free, very good)
- Julia Evans' zines: "HTTP: Learn your browser's language", "Networking! ACK!" (wizardzines.com)
- Hussein Nasser (YouTube): networking + backend fundamentals
- httpbin.org: free server that echoes back your requests, for practice
