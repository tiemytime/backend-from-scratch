// Security basics: rate limiting, security headers, body limits, XSS, safe errors.
// Run: node example.js
// Then follow the "Try it" table in notes.md.
const express = require("express");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ---------- 1. Don't announce what you're built with ----------

// By default Express adds "X-Powered-By: Express" to every reply.
// That tells attackers which known bugs to try. Free to remove.
app.disable("x-powered-by");

// ---------- 2. Security headers ----------

// Instructions for the BROWSER on how to treat our pages.
// In a real app, `helmet` sets all of these (and more) in one line.
function securityHeaders(req, res, next) {
  // Only run scripts that come from our own origin. No inline <script>,
  // no onerror="...". This is the safety net if XSS slips through.
  res.set("Content-Security-Policy", "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'");
  // Don't let other sites put our pages inside an <iframe> (clickjacking).
  res.set("X-Frame-Options", "DENY");
  // Trust the Content-Type we send. Don't guess that a .txt is really a script.
  res.set("X-Content-Type-Options", "nosniff");
  // When a user clicks a link away from us, only tell the other site our domain, not the full URL.
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // HTTPS only sites would also send:
  // Strict-Transport-Security: max-age=31536000; includeSubDomains
  next();
}

// ---------- 3. Body size limit ----------

// Without a limit, someone can POST a 500 MB body and fill your memory.
// Bigger than 10 KB is rejected with 413 Payload Too Large before any route runs.
app.use(express.json({ limit: "10kb" }));

// ---------- 4. Rate limiting ----------

// "Each visitor gets N tries per time window." Here: fixed window per IP.
// Stored in memory, so it resets on restart and isn't shared between servers.
// Real apps use `express-rate-limit`, with Redis when there's more than one server.
function rateLimit({ windowMs, max }) {
  const hits = new Map(); // ip -> { count, resetAt }

  return (req, res, next) => {
    const now = Date.now();
    let entry = hits.get(req.ip);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(req.ip, entry);
    }
    entry.count++;

    const secondsLeft = Math.ceil((entry.resetAt - now) / 1000);
    res.set("RateLimit-Limit", String(max));
    res.set("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    res.set("RateLimit-Reset", String(secondsLeft));

    if (entry.count > max) {
      res.set("Retry-After", String(secondsLeft));
      return res.status(429).json({ error: `Too many attempts. Try again in ${secondsLeft}s.` });
    }
    next();
  };
}

// Strict limit on login: 5 tries per minute per IP. Stops password guessing.
const loginLimiter = rateLimit({ windowMs: 60_000, max: 5 });
// Loose limit on the rest of the API, so one client can't hog the server.
const apiLimiter = rateLimit({ windowMs: 60_000, max: 100 });

app.use("/api", apiLimiter);

app.post("/api/login", loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  // Real app: look the user up and bcrypt.compare (topic 06). Kept tiny here.
  if (email === "asha@example.com" && password === "123456789") {
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Wrong email or password" });
});

// ---------- 5. XSS: user text shown on a page ----------

const notes = [{ id: 1, text: "Buy milk" }];

app.post("/api/notes", (req, res) => {
  const text = req.body?.text;
  if (typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "text is required" });
  }
  const note = { id: notes.length + 1, text };
  notes.push(note);
  res.status(201).json(note);
});

// Turn the 5 characters that mean something in HTML into harmless text.
// "<script>" becomes "&lt;script&gt;": the browser SHOWS it, doesn't RUN it.
function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function notesPage(title, items) {
  return `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="font-family: sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px">
<h1>${title}</h1><ul>${items}</ul></body>`;
}

// BROKEN: pastes user text straight into HTML, and sends no CSP.
// A note like <img src=x onerror=alert(1)> becomes real HTML and runs.
app.get("/broken/notes", (req, res) => {
  const items = notes.map((n) => `<li>${n.text}</li>`).join("");
  res.send(notesPage("Notes (broken)", items));
});

// SAFE: escapes user text AND sends security headers (two layers).
app.get("/notes", securityHeaders, (req, res) => {
  const items = notes.map((n) => `<li>${escapeHtml(n.text)}</li>`).join("");
  res.send(notesPage("Notes (safe)", items));
});

// ---------- 6. Errors: log the details, hide them from the client ----------

app.get("/api/crash", (req, res) => {
  // Pretend the database password ended up in an error message.
  throw new Error("connect failed: postgres://admin:SuperSecret@10.0.0.5/notes");
});

// Unknown routes: a plain 404, no hints.
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Express calls this when any route throws (4 arguments = error handler).
// Without it, Express sends the stack trace as HTML when not in production.
app.use((err, req, res, next) => {
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Body too large (max 10kb)" });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON" });
  }
  console.error("[error]", err); // full details stay in OUR logs
  res.status(500).json({ error: "Something went wrong" }); // client learns nothing
});

app.listen(PORT, () => console.log(`Security demo on http://localhost:${PORT}`));
