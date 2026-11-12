// Login that the server remembers, using a session cookie. Run: node example.js
const crypto = require("node:crypto");
const express = require("express");
const bcrypt = require("bcryptjs");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

// Stand-ins for database tables. Lost on restart.
const users = [];
const sessions = new Map(); // sessionId -> { userId, expiresAt }

const DUMMY_HASH = bcrypt.hashSync("dummy-password-never-used", 12);

// ---------- Cookie + session helpers ----------

// "sid=abc123; theme=dark" -> { sid: "abc123", theme: "dark" }
function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const pair of header.split(";")) {
    const [name, ...rest] = pair.trim().split("=");
    if (name) cookies[name] = decodeURIComponent(rest.join("="));
  }
  return cookies;
}

function createSession(userId) {
  // 32 random bytes = 64 hex characters. Impossible to guess.
  const id = crypto.randomBytes(32).toString("hex");
  sessions.set(id, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
  return id;
}

const cookieOptions = {
  httpOnly: true, // JavaScript in the page can't read it
  sameSite: "lax", // not sent on POSTs from other websites
  secure: process.env.NODE_ENV === "production", // HTTPS only in production
  maxAge: SESSION_TTL_MS, // browser deletes it after this
  path: "/",
};

// ---------- Middleware ----------

// Runs on every request: "who is this?" Sets req.user, or leaves it undefined.
function loadUser(req, res, next) {
  const sid = parseCookies(req.headers.cookie).sid;
  const session = sid && sessions.get(sid);

  if (session && session.expiresAt > Date.now()) {
    req.sessionId = sid;
    req.user = users.find((u) => u.id === session.userId);
  } else if (session) {
    sessions.delete(sid); // expired, clean it up
  }
  next();
}

// Put in front of routes that need a logged-in user
function requireLogin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Please log in" });
  }
  next();
}

app.use(loadUser);

// ---------- Routes ----------

app.post("/api/signup", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "email and password (8+ chars) required" });
  }
  if (users.some((u) => u.email === email)) {
    return res.status(409).json({ error: "Email already registered" });
  }
  const user = { id: users.length + 1, email, passwordHash: await bcrypt.hash(password, 12) };
  users.push(user);
  res.status(201).json({ id: user.id, email: user.email });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = users.find((u) => u.email === email);
  const ok = await bcrypt.compare(String(password), user ? user.passwordHash : DUMMY_HASH);

  if (!user || !ok) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  // Throw away any old session this browser had, then make a brand new one
  if (req.sessionId) sessions.delete(req.sessionId);
  const sid = createSession(user.id);

  res.cookie("sid", sid, cookieOptions); // adds the Set-Cookie header
  res.json({ message: "Logged in", user: { id: user.id, email: user.email } });
});

app.get("/api/me", requireLogin, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email });
});

app.post("/api/logout", requireLogin, (req, res) => {
  sessions.delete(req.sessionId); // the important part: the server forgets it
  res.clearCookie("sid", { ...cookieOptions, maxAge: undefined }); // tidy up the browser too
  res.json({ message: "Logged out" });
});

// FOR LEARNING ONLY: shows what the server remembers. Never ship this.
app.get("/debug/sessions", (req, res) => {
  res.json(Object.fromEntries(sessions));
});

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Bad JSON" });
  }
  console.log(err);
  res.status(500).json({ error: "Something broke on our side" });
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
