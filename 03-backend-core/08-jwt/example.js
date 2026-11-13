// Login with a JWT instead of a session.
// Run: JWT_SECRET=dev-secret-change-me node example.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = process.env.TOKEN_TTL || "15m"; // short on purpose, see notes

// Fail fast (topic 05): no secret, no server
if (!JWT_SECRET) {
  console.error("JWT_SECRET is missing. Run: JWT_SECRET=dev-secret-change-me node example.js");
  process.exit(1);
}

// Stand-in for a database table. Lost on restart.
// Notice: there is NO sessions table this time.
const users = [];

const DUMMY_HASH = bcrypt.hashSync("dummy-password-never-used", 12);

// ---------- Middleware ----------

// Reads "Authorization: Bearer <token>", checks the signature and expiry.
function requireLogin(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Please log in" });
  }

  try {
    // Pin the algorithm so nobody can trick us into a weaker one
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    // err.name is "TokenExpiredError" or "JsonWebTokenError" (bad signature, garbage...)
    const error = err.name === "TokenExpiredError" ? "Token expired, log in again" : "Invalid token";
    return res.status(401).json({ error });
  }
}

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

  // Everything in here is READABLE by anyone holding the token. No secrets.
  const token = jwt.sign({ sub: String(user.id), email: user.email }, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: TOKEN_TTL,
  });

  res.json({ token });
});

// No database lookup here: the token itself says who you are
app.get("/api/me", requireLogin, (req, res) => {
  res.json(req.user);
});

// The catch with JWTs: the server has nothing to delete
app.post("/api/logout", (req, res) => {
  res.json({ message: "Throw the token away on your side. The server can't cancel it." });
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
