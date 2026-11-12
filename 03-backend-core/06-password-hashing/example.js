// Signup and login with hashed passwords. Run: node example.js
const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");

const app = express();
app.use(express.json());

// Stand-in for a database table. Lost on restart.
const users = [];

// Used when the email doesn't exist, so login takes the same time either way
const DUMMY_HASH = bcrypt.hashSync("dummy-password-never-used", 12);

// ---------- Schemas ----------

const credentialsSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "email doesn't look valid" })),
  password: z
    .string({ error: "password is required" })
    .min(8, { error: "password must be at least 8 characters" })
    .refine((p) => Buffer.byteLength(p) <= 72, { error: "password is too long" }),
});

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: result.error.issues.map((i) => ({ field: i.path.join(".") || "(body)", message: i.message })),
      });
    }
    req.body = result.data;
    next();
  };
}

// ---------- Routes ----------

app.post("/api/signup", validateBody(credentialsSchema), async (req, res) => {
  const { email, password } = req.body;

  if (users.some((u) => u.email === email)) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = { id: users.length + 1, email, passwordHash };
  users.push(user);

  res.status(201).json({ id: user.id, email: user.email }); // never send the hash back
});

app.post("/api/login", validateBody(credentialsSchema), async (req, res) => {
  const { email, password } = req.body;

  const user = users.find((u) => u.email === email);
  // Always run bcrypt, even for unknown emails, so the response time doesn't
  // tell an attacker which emails are registered
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

  if (!user || !ok) {
    // Same message whether the email or the password was wrong
    return res.status(401).json({ error: "Invalid email or password" });
  }

  res.json({ message: "Logged in", user: { id: user.id, email: user.email } });
});

// FOR LEARNING ONLY: shows what the "database" really stores. Never ship this.
app.get("/debug/users", (req, res) => {
  res.json(users);
});

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Bad JSON" });
  }
  console.log(err);
  res.status(500).json({ error: "Something broke on our side" });
});

app.listen(3000, () => {
  console.log("Listening on port 3000");
});
