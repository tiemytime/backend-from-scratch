// Authorization: logged in is not the same as allowed.
// Run: JWT_SECRET=dev-secret-change-me node example.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("JWT_SECRET is missing. Run: JWT_SECRET=dev-secret-change-me node example.js");
  process.exit(1);
}

// Stand-in database, filled in at startup so you can log in straight away.
// Every password is "123456789".
const hash = bcrypt.hashSync("123456789", 10);
const users = [
  { id: 1, email: "asha@example.com", role: "user", passwordHash: hash },
  { id: 2, email: "ravi@example.com", role: "user", passwordHash: hash },
  { id: 3, email: "admin@example.com", role: "admin", passwordHash: hash },
];
const notes = [
  { id: 1, ownerId: 1, text: "Asha's shopping list" },
  { id: 2, ownerId: 1, text: "Asha's diary" },
  { id: 3, ownerId: 2, text: "Ravi's gym plan" },
];

// ---------- Step 1: authentication (WHO are you?) ----------

// Same as topic 08, with one change: the token only carries the user id.
// The role is read fresh from the "database" on every request, so if an admin
// is demoted, it takes effect on their very next request, not when the token expires.
function requireLogin(req, res, next) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Please log in" });
  }
  try {
    const { sub } = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    const user = users.find((u) => u.id === Number(sub));
    if (!user) return res.status(401).json({ error: "Account no longer exists" });
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ---------- Step 2: authorization (are you ALLOWED?) ----------

// Rule type A, by role: "only admins can do this", known before touching any data.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You don't have permission" });
    }
    next();
  };
}

// Rule type B, by ownership: "only the owner can do this", needs the data loaded first.
// One small function, used by every route, so the rule lives in one place.
function canAccess(user, note) {
  return user.role === "admin" || note.ownerId === user.id;
}

// ---------- Routes ----------

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = users.find((u) => u.email === email);
  const ok = user && (await bcrypt.compare(String(password), user.passwordHash));
  if (!ok) return res.status(401).json({ error: "Invalid email or password" });

  const token = jwt.sign({ sub: String(user.id) }, JWT_SECRET, { algorithm: "HS256", expiresIn: "15m" });
  res.json({ token });
});

// List: filter, so you only ever see your own (admins see all)
app.get("/api/notes", requireLogin, (req, res) => {
  res.json(notes.filter((n) => canAccess(req.user, n)));
});

// Create: the owner comes from the token, NEVER from the body
app.post("/api/notes", requireLogin, (req, res) => {
  const text = req.body?.text;
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }
  const note = { id: Math.max(0, ...notes.map((n) => n.id)) + 1, ownerId: req.user.id, text };
  notes.push(note);
  res.status(201).json(note);
});

// Read one: load it, THEN check ownership.
// Someone else's note gets 404, not 403, so strangers can't even learn it exists.
app.get("/api/notes/:id", requireLogin, (req, res) => {
  const note = notes.find((n) => n.id === Number(req.params.id));
  if (!note || !canAccess(req.user, note)) {
    return res.status(404).json({ error: "Note not found" });
  }
  res.json(note);
});

app.delete("/api/notes/:id", requireLogin, (req, res) => {
  const index = notes.findIndex((n) => n.id === Number(req.params.id));
  if (index === -1 || !canAccess(req.user, notes[index])) {
    return res.status(404).json({ error: "Note not found" });
  }
  notes.splice(index, 1);
  res.status(204).end();
});

// Admin only: two checks in a row, login first, then role
app.get("/api/admin/users", requireLogin, requireRole("admin"), (req, res) => {
  res.json(users.map(({ passwordHash, ...rest }) => rest));
});

// Admin only: change someone's role. Shows why role is read from the DB, not the token.
app.patch("/api/admin/users/:id/role", requireLogin, requireRole("admin"), (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: "User not found" });
  if (!["user", "admin"].includes(req.body?.role)) {
    return res.status(400).json({ error: "role must be user or admin" });
  }
  user.role = req.body.role;
  res.json({ id: user.id, email: user.email, role: user.role });
});

// ---------- DON'T DO THIS: the classic bug ----------

// Logged in? Yes. Owner? Never checked. Any user can read any note by changing the number.
app.get("/api/broken/notes/:id", requireLogin, (req, res) => {
  const note = notes.find((n) => n.id === Number(req.params.id));
  if (!note) return res.status(404).json({ error: "Note not found" });
  res.json(note);
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
