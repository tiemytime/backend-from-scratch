# Config and environment variables

[← Project structure](../04-project-structure/) · [Backend core](../) · [Password hashing →](../06-password-hashing/)

## 1. The problem

In the middleware example the admin key was written right in the code:

```js
if (req.get("X-Admin-Key") !== "letmein") { ... }
```

Three things are wrong with that:

1. **Anyone who sees the code sees the secret.** Push to GitHub and it's public. Bots scan GitHub for keys **within minutes**.
2. **Different machines need different values.** Port 3000 on your laptop, whatever port the hosting company gives you in production. A test database for testing, the real one for real users.
3. **Changing a value means changing code** and deploying again.

**Config** means the settings that change between places (port, database address, secret keys). **Keep config outside the code.**

## 2. In plain words

A restaurant chain has the **same recipe book** in every branch. But each branch has its own **address**, its own **safe code**, its own **supplier phone number**.

You don't print the safe code inside the recipe book that every branch and every new cook gets. Each branch keeps it on a **card in the manager's drawer**.

- Recipe book = your **code**, the same everywhere, safe to share
- Card in the drawer = **environment variables**, different per place, kept private

## 3. Environment variables

An **environment variable** is a `NAME=value` setting that the operating system hands to a program when it starts. Every program gets its own copy.

You've already used one: `PATH`, from the terminal notes.

```bash
echo $PATH                 # shell: read one
PORT=4000 node server.js   # give one to a single command
```

In Node they all arrive in **`process.env`**:

```js
console.log(process.env.PORT);       // "4000"
console.log(process.env.HOME);       // "/home/you"
console.log(process.env.NOPE);       // undefined
```

### ⚠️ They're always strings

```js
process.env.PORT          // "3000", the string, not the number 3000
process.env.DEBUG         // "false", the string

if (process.env.DEBUG) { ... }   // RUNS, because "false" is a non-empty string, so it's truthy
```

Tested:

```
DEBUG is ON?! value: "false"
```

You always have to convert: `Number(process.env.PORT)`, `process.env.DEBUG === "true"`. Section 6 does this properly.

## 4. The `.env` file

Typing `PORT=3000 ADMIN_KEY=... DATABASE_URL=... node server.js` every time is painful. So we write them into a file called **`.env`**:

```
NODE_ENV=development
PORT=3000
ADMIN_KEY=super-secret-123
```

And tell Node to load it (built into Node 20.6 and newer):

```bash
node --env-file=.env server.js
```

Older projects use the **`dotenv`** library for the same thing (`require("dotenv").config()`). You'll see it everywhere. It does exactly the same job.

**If a value is set both in the shell and in `.env`, the shell wins.** Tested:

```bash
PORT=3991 node --env-file=.env server.js    # .env says 3992
# Listening on port 3991
```

That's useful: `.env` holds your normal values, and you override one for a single run.

## 5. `.env` must never reach git

```
# .gitignore
.env
```

But then how does a new teammate know **which** variables to set? You commit a **`.env.example`** with the names and fake values:

```
# Copy this file to .env and fill in real values:
#   cp .env.example .env
NODE_ENV=development
PORT=3000
ADMIN_KEY=change-me-to-something-long
```

| File | Committed? | Contains |
|---|---|---|
| `.env` | ❌ never | real values, real secrets |
| `.env.example` | ✅ yes | names + fake values, as instructions |

### If a secret does leak

Deleting the file or the commit is **not enough**. It stays in git history, in forks, and in the bots' copies.

1. **Rotate it:** make a new key in the service's dashboard and kill the old one. This is the only real fix.
2. Then clean up the code.

GitHub has **secret scanning** that warns when it spots known key formats in a push.

## 6. One `config.js` file, checked at startup

Instead of `process.env.X` scattered across 30 files, read everything **once**, in **one** file, and **validate it with zod**. Same idea as validating requests, but for settings:

```js
const { z } = require("zod");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  ADMIN_KEY: z
    .string({ error: "ADMIN_KEY is required" })
    .min(8, { error: "ADMIN_KEY must be at least 8 characters" }),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("❌ Bad config. Fix your .env file:");
  for (const issue of result.error.issues) {
    console.error("  -", issue.path.join("."), ":", issue.message);
  }
  process.exit(1);
}

const env = result.data;

module.exports = {
  env: env.NODE_ENV,
  port: env.PORT,
  adminKey: env.ADMIN_KEY,
};
```

| Line | Why |
|---|---|
| `z.enum([...])` | Only these exact words. A typo like `prod` is caught. |
| `z.coerce.number()` | Turns the string `"3000"` into the number `3000` |
| `.default(3000)` | Fine to leave out, has a safe default |
| `ADMIN_KEY` with **no** default | A secret must never have a default in code, or it's back to being a secret in the code |
| `process.exit(1)` | Stop the program **right now**. `1` means "ended with an error". |

Anywhere else in the app:

```js
const config = require("./config");

if (req.get("X-Admin-Key") !== config.adminKey) { ... }
app.listen(config.port);
```

### Why crash at startup? ("fail fast")

Without the check, a missing `ADMIN_KEY` means `config.adminKey` is `undefined`. The server starts happily and looks fine. Hours later someone sends a request with **no** key header, and `undefined !== undefined` is `false`... **so they get in as admin.**

With the check, the server refuses to start and tells you exactly what's missing:

```
❌ Bad config. Fix your .env file:
  - ADMIN_KEY : ADMIN_KEY is required
```

**A server that won't start is much better than a server that starts broken.** You notice it in 1 second, not after an incident.

## 7. Environments: development, test, production

The same code runs in different places:

| Environment | Where | Example settings |
|---|---|---|
| **development** | your laptop | port 3000, local database, detailed error messages |
| **test** | automated tests | a throwaway test database |
| **production** | the real server, real users | real database, real payment keys, short safe error messages |

`NODE_ENV` says which one this is. Many libraries (Express included) behave a bit more safely and faster when `NODE_ENV=production`.

## 8. Where the values live in real life

| Where the app runs | How you set env vars |
|---|---|
| Your laptop | `.env` file |
| Vercel, Render, Railway, Heroku | "Environment Variables" page in the dashboard |
| Docker | `docker run -e PORT=3000 ...` or `--env-file .env` |
| Kubernetes | ConfigMaps (normal settings) and Secrets (secret ones) |
| Big companies | Secret managers: AWS Secrets Manager, HashiCorp Vault, Doppler. Secrets are stored encrypted, access is logged, and keys can rotate automatically. |

The code stays the same everywhere. It only ever reads `process.env`. **Where** the values come from is the platform's job.

This idea comes from the **Twelve-Factor App** guidelines (12factor.net), factor III: *"Store config in the environment."*

## 9. Config or not?

| Value | Put it in env? | Why |
|---|---|---|
| Database password, API keys, admin key | ✅ yes | secret |
| Port, database address | ✅ yes | changes per environment |
| Feature on/off for one environment | ✅ yes | changes per environment |
| "Note text max 200 characters" | ❌ no, keep in code | it's a rule of your app, the same everywhere |
| List of note statuses | ❌ no, keep in code | same everywhere |

**The test:** "Could I make this repo public right now without leaking anything?" If yes, the config is in the right place.

## 10. Try it

```bash
cd 03-backend-core/05-config-env
node server.js                       # ❌ ADMIN_KEY is required, exits
cp .env.example .env                 # make your own .env
node --env-file=.env server.js       # starts
```

| Try | Result |
|---|---|
| `curl localhost:3000/admin/stats` | 401 |
| `curl localhost:3000/admin/stats -H 'X-Admin-Key: change-me-to-something-long'` | 200 |
| Edit `.env`: `ADMIN_KEY=abc`, restart | ❌ must be at least 8 characters |
| Edit `.env`: `NODE_ENV=prod`, restart | ❌ expected one of "development", "test", "production" |
| `PORT=4000 node --env-file=.env server.js` | listens on 4000, the shell wins over `.env` |
| `git status` | `.env` is **not** listed, because it's ignored |

**Env vars are read once, when the program starts.** After editing `.env`, restart the server.

## 11. Common mistakes

| Mistake | What happens |
|---|---|
| Committing `.env` | Secrets are public, forever, in git history |
| A default value for a secret in code (`ADMIN_KEY \|\| "letmein"`) | The secret is in the code again, and production may quietly run with it |
| `if (process.env.DEBUG)` | `"false"` is truthy, so it's always on |
| `process.env.PORT + 1` | `"3000" + 1` is `"30001"`, string joining |
| `process.env.X` read in 30 files | Nobody knows the full list, typos go unnoticed |
| No check at startup | Server starts broken, fails later in a confusing way (or lets attackers in) |
| Editing `.env` and not restarting | Old values still in use |
| Deleting a leaked key from git and calling it done | Must rotate the key |

## 12. Check yourself

<details>
<summary>1. A new teammate clones the repo. How do they know which env vars to set?</summary>

From `.env.example`, which is committed. They copy it to `.env` and fill in real values.
</details>

<details>
<summary>2. <code>.env</code> has <code>PORT=3000</code>. You run <code>PORT=5000 node --env-file=.env server.js</code>. Which port?</summary>

5000. A value already in the shell wins over the file.
</details>

<details>
<summary>3. Why is <code>if (process.env.DEBUG)</code> wrong when <code>DEBUG=false</code>?</summary>

Env vars are always strings. `"false"` is a non-empty string, so it's truthy. Compare instead: `process.env.DEBUG === "true"`.
</details>

<details>
<summary>4. Why does the server deliberately crash when <code>ADMIN_KEY</code> is missing?</summary>

Fail fast. Otherwise it starts with `adminKey = undefined`, and a request with no header compares `undefined !== undefined`, which is false, so it lets them in.
</details>

<details>
<summary>5. You accidentally pushed a Stripe key. What's the first thing to do?</summary>

Rotate it: create a new key in Stripe and revoke the old one. Removing it from git doesn't help, since it's already been copied.
</details>
