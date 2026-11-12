# Password hashing

[← Config and env vars](../05-config-env/) · [Backend core](../)

## 1. The problem

To log someone in, the server has to check their password. The obvious way is to store it:

```
id | email             | password
1  | asha@example.com  | 123456789
```

Then one day the database leaks. It happens to big companies all the time: a stolen backup, a hacked server, a careless employee, a bug. Now the attacker has **every user's password**. Most people **reuse** their password, so the attacker also gets into their Gmail, their bank, their Instagram.

Real cases:

| Year | Company | How passwords were stored | Result |
|---|---|---|---|
| 2009 | RockYou | **plain text** | 32 million passwords published as-is. The "rockyou.txt" list is still used by attackers today. |
| 2012 | LinkedIn | SHA-1 hash, **no salt** | most were cracked within days |
| 2013 | Adobe | **encrypted** (not hashed), with password hints in plain text | huge numbers recovered from hints and repeated values |

**Goal: store passwords so that even if the whole database is stolen, the passwords can't be read. Not by hackers, and not by you either.**

## 2. In plain words: the smoothie

Put a banana, milk and honey into a blender. You get a smoothie.

- Same ingredients always give **the same smoothie**.
- You **can't** turn a smoothie back into a banana.
- Change one ingredient slightly and the smoothie tastes **completely** different.

That's a **hash**. Your password goes in, a scrambled fingerprint comes out, and there's no way back.

**So how does login work if you can't get the password back?** You don't need it back. When Asha logs in, you blend what she typed **again** and compare the two smoothies. Same smoothie means same password.

```
Signup:  "123456789" → [hash] → $2b$12$VLE/F54N...   ← store ONLY this
Login:   "123456789" → [hash] → $2b$12$VLE/F54N...   ← same? ✅ logged in
Login:   "wrongpass" → [hash] → $2b$12$Xq9...        ← different? ❌ rejected
```

## 3. Hashing vs encryption

People mix these up all the time.

| | Encryption | Hashing |
|---|---|---|
| Can you get the original back? | ✅ yes, with the key | ❌ never |
| Shop | a locked box (anyone with the key opens it) | a smoothie |
| Used for | data you need to read later: messages, files, card details | **passwords** |
| If the key is stolen | everything is readable | there is no key |

Adobe **encrypted** its passwords. When the attackers worked out the patterns, they could recover passwords, because encryption is meant to be undone. **Passwords must be hashed, never encrypted.**

> If a website can **email you your current password** after "forgot password", it isn't hashing. Don't trust it with a password you use anywhere else.

## 4. Why a normal hash isn't enough

Run the demo:

```bash
node hash-demo.js
```

It uses SHA-256, a famous, normal hash.

### Problem 1: same password → same hash

```
asha  (123456) -> 8d969eef6ecad3c29a3a629280e686cf...
ravi  (123456) -> 8d969eef6ecad3c29a3a629280e686cf...
```

Attackers keep giant ready-made lists: "hash of `123456` is `8d969eef...`", for millions of common passwords. These are called **rainbow tables**, or lookup tables. Steal the database, look each hash up, done. And everyone sharing a password is exposed together.

### Problem 2: normal hashes are fast

```
about 984,192 guesses per second (one CPU core, a GPU does billions)
```

SHA-256 was **designed to be fast**, which is great for checking files and terrible for passwords. An attacker with a gaming GPU tries billions of guesses a second. Every 8-character lowercase password falls quickly.

## 5. Fix 1: salt

A **salt** is a random string, **different for every user**, mixed in before hashing:

```
asha  salt 459c8360... + "123456" -> f1f512ed...
ravi  salt 20274ed4... + "123456" -> 9db3e9d5...
```

- Same password, **different** hashes.
- Ready-made lookup tables are useless. They'd need a separate table for every possible salt.
- The salt is **not secret**. It's stored right next to the hash. Its only job is to make every hash unique.

## 6. Fix 2: slow on purpose

Password hashes are **designed to be slow**, and you choose how slow:

```
one scrypt hash took 65ms
about 15 guesses per second instead of 984,192
```

| Who | Hashes needed | 0.1 seconds each means |
|---|---|---|
| A real user logging in | 1 | they don't notice 0.1 seconds |
| An attacker trying 1 billion guesses | 1,000,000,000 | about 3 years, per user |

**Slow is the feature.** It barely costs the real user anything, and it makes the attacker's job thousands of times slower.

## 7. Which algorithm to use

| Algorithm | Salt built in | Slow on purpose | Use it? |
|---|---|---|---|
| plain text | | | ❌ never |
| MD5, SHA-1, SHA-256 | ❌ | ❌ fast | ❌ never for passwords (fine for checking files) |
| **bcrypt** | ✅ | ✅ | ✅ most common, safe, everywhere |
| **scrypt** | ✅ | ✅ | ✅ built into Node (`crypto.scrypt`) |
| **argon2id** | ✅ | ✅ | ✅ the newest, first choice in OWASP's guidelines |

Any of the three good ones is fine. **Never write your own.** We use **bcrypt** (the `bcryptjs` package, pure JavaScript and easy to install).

## 8. bcrypt in code

```bash
pnpm add bcryptjs
```

### Signup: hash and store

```js
const passwordHash = await bcrypt.hash(password, 12);
```

- `12` is the **cost**: bcrypt repeats its work 2¹² = 4,096 times. Each +1 **doubles** the time. Pick a value that takes roughly a quarter of a second on your server. 10 to 12 is the usual range today.
- You **don't** make a salt yourself. bcrypt creates one and puts it **inside** the result.

### What gets stored

```
$2b$12$VLE/F54NfbxUjP6MF01TFeVqPXxhE7xcQJ.G81tsjJjDcHk46rO5q
```

| Part | Meaning |
|---|---|
| `$2b$` | which version of bcrypt |
| `12$` | the cost |
| `VLE/F54NfbxUjP6MF01TFe` | the salt (22 characters) |
| `VqPXxhE7xcQJ.G81tsjJjDcHk46rO5q` | the hash itself |

Everything needed to check a password later is in this one string, so you store it in a single column.

Asha and Ravi both used `123456789`. Their stored values are completely different, because of the salt:

```
asha  $2b$12$VLE/F54NfbxUjP6MF01TFeVqPXxhE7...
ravi  $2b$12$F4lmKQbPC5Swvjd3eaFv/OLyGIfwfN...
```

### Login: compare

```js
const ok = await bcrypt.compare(password, user.passwordHash);
```

`compare` reads the salt and cost out of the stored string, hashes what the user typed the same way, and checks whether the results match. It gives back `true` or `false`.

### Why `await`?

Hashing takes about 0.25 seconds **on purpose**. `bcrypt.hash` and `bcrypt.compare` return a **promise**: "I'll have the answer soon". `await` means "wait here for the answer". While this request waits, the server keeps serving other requests. That's why the route function is marked `async`.

`bcrypt.hashSync` exists too, but it **blocks the whole server** while it works. Every other user waits. Use it only at startup, never inside a route.

## 9. The full example

[`example.js`](./example.js): signup and login.

```js
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
```

- **409 Conflict** means "this clashes with something that already exists".
- The response contains **no hash**. The hash never leaves the server.
- The plain `password` is only ever in memory for this one request. It's never saved, never logged.

```js
app.post("/api/login", validateBody(credentialsSchema), async (req, res) => {
  const { email, password } = req.body;

  const user = users.find((u) => u.email === email);
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

  if (!user || !ok) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  res.json({ message: "Logged in", user: { id: user.id, email: user.email } });
});
```

Two security details are hiding in here.

### Detail 1: the same error for "no such email" and "wrong password"

If you say "No account with that email", an attacker can test a list of emails and learn who has an account on your site. That's called **user enumeration**, and it's useful for phishing, or embarrassing on some kinds of sites. So both cases say **"Invalid email or password"**.

### Detail 2: same **time** too (a bug found while testing)

The first version only ran bcrypt when the email existed. Measured with curl:

```
wrong password, real email   → 401 in 0.280s   (bcrypt ran)
email doesn't exist          → 401 in 0.0009s  (bcrypt skipped)
```

The **message** was identical, but the **time** gave it away. An attacker just measures how fast you answer. The fix is to always run bcrypt, against a dummy hash when there's no user:

```js
const DUMMY_HASH = bcrypt.hashSync("dummy-password-never-used", 12);  // once, at startup
```

After the fix, all cases take about 0.28s. This is called a **timing attack**.

## 10. Password rules that actually help

| Rule | Why |
|---|---|
| **Minimum 8 characters** (longer is better) | Length matters most. A long passphrase beats `P@ssw0rd!` |
| **No silly composition rules** ("1 capital, 1 symbol, 1 digit") | People just write `Password1!`. Current NIST guidance drops these rules. |
| **A maximum length** | bcrypt only uses the first **72 bytes**, and huge inputs can be used to slow your server down. We reject over 72 bytes. |
| **Block known-leaked passwords** | e.g. check against the "Have I Been Pwned" Pwned Passwords list |
| **Rate-limit login** | Slow hashing protects stolen hashes. Rate limiting protects the live login form. (Security basics topic.) |
| **Never log passwords** | Not in console logs, not in error messages, not in request logs |
| **Lowercase and trim emails** | `Asha@Example.com ` and `asha@example.com` are the same person |

## 11. Real-world

| Company / tool | Uses |
|---|---|
| Most Node, Rails, PHP and Python apps | bcrypt |
| Django (Python) | PBKDF2 by default, argon2 and bcrypt supported |
| Login services (Clerk, Auth0, Supabase Auth, Firebase Auth) | do all of this for you. That's half of why they exist. |

Even if you use a login service later, knowing this tells you **what** they protect you from, and what to look for when choosing one.

## 12. Try it

```bash
cd 03-backend-core/06-password-hashing
node hash-demo.js     # the why: same hashes, speed, salt, slow hashing
node example.js       # the server
```

| Command | Result |
|---|---|
| `curl localhost:3000/api/signup -H 'Content-Type: application/json' -d '{"email":"Asha@Example.com","password":"123456789"}'` | 201, email lowercased, no hash in the response |
| same command again | 409, already registered |
| `curl localhost:3000/api/signup -H 'Content-Type: application/json' -d '{"email":"ravi@example.com","password":"123456789"}'` | 201 |
| `curl localhost:3000/debug/users` | both hashes completely different, same password |
| `curl localhost:3000/api/login -H 'Content-Type: application/json' -d '{"email":"asha@example.com","password":"123456789"}'` | 200, logged in |
| same, with `"password":"wrongpass1"` | 401, Invalid email or password |
| same, with `"email":"ghost@example.com"` | 401, the **same** message |
| add `-w ' %{time_total}s\n'` to the login commands | all take about the same time |

`/debug/users` is only there so you can see what's stored. **A real app must never have a route like this.**

Note: `"Logged in"` here only means the password was right. The server **forgets you immediately**. The next request has no idea who you are. Remembering a logged-in user is the next topic: **sessions and cookies**.

## 13. Common mistakes

| Mistake | What happens |
|---|---|
| Storing plain passwords | One leak exposes every user, and their other accounts too |
| Using MD5 / SHA-1 / SHA-256 for passwords | Cracked with lookup tables and GPUs |
| Encrypting instead of hashing | Whoever gets the key gets every password |
| Making your own salt + hash scheme | Easy to get subtly wrong. Use bcrypt / scrypt / argon2. |
| Sending `passwordHash` back in a response | Leaks the hash. Pick the fields you send. |
| Different messages for "no such user" and "wrong password" | User enumeration |
| Skipping bcrypt for unknown emails | Timing attack, same result as above |
| `hashSync` / `compareSync` inside a route | The whole server freezes for every hash |
| Logging `req.body` on the login route | Passwords end up in log files |
| Cost too low (like 4) | Hardly slower than SHA-256 |

## 14. Check yourself

<details>
<summary>1. If you can't un-hash a password, how does login work?</summary>

Hash what the user typed (with the same salt and cost, read from the stored string) and compare with the stored hash. Same result means same password.
</details>

<details>
<summary>2. The salt is stored right next to the hash. Doesn't that help the attacker?</summary>

No. The salt isn't a secret. Its job is to make every user's hash unique, so ready-made lookup tables don't work and two users with the same password don't share a hash. The attacker still has to guess each password, slowly, one user at a time.
</details>

<details>
<summary>3. Why is "slow" a good thing for a password hash?</summary>

One real login costs a quarter of a second, which nobody notices. An attacker needs billions of guesses, so a quarter of a second each makes cracking take years instead of minutes.
</details>

<details>
<summary>4. Why "Invalid email or password" instead of "No account with that email"?</summary>

So attackers can't find out which emails are registered (user enumeration).
</details>

<details>
<summary>5. The messages were identical, but attackers could still tell. How, and what was the fix?</summary>

By timing. Unknown emails returned instantly because bcrypt was skipped. The fix is to always run `bcrypt.compare`, against a dummy hash if the user doesn't exist.
</details>

<details>
<summary>6. A site emails you your current password when you click "forgot password". What does that tell you?</summary>

They store it as plain text or encrypted, not hashed. A safe site can only send a link to set a **new** password.
</details>
