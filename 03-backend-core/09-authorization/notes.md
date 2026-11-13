# Authorization

> Logged in is not the same as allowed.

## 1. The problem

Topics 07 and 08 answered one question: **who is this?** (authentication).

But knowing who someone is doesn't tell you what they may do. Asha is logged in. Should she be able to:

- read Ravi's diary? No.
- delete Ravi's note? No.
- see the list of every user? Only if she's an admin.

Answering **"is this person allowed to do this?"** is **authorization**. If you skip it, every logged-in user can do everything. This is the most common serious bug in real APIs.

## 2. In plain words: the hotel

| Hotel | API |
|---|---|
| Reception checks your ID and gives you a key card | **Authentication**: login, session or JWT |
| Your key card opens **your** room, not room 204 | **Ownership check**: you can only touch your own notes |
| Staff cards open the staff room, guest cards don't | **Role check**: only admins reach admin routes |
| A guest card opening every room | The bug in section 6 |

Two questions, always in this order:

1. **Who are you?** No idea: `401 Unauthorized` (the name is confusing, it really means "not logged in").
2. **Are you allowed?** No: `403 Forbidden` (or `404`, see section 5).

## 3. Two kinds of rules

| Kind | Example | When can you check it? |
|---|---|---|
| **By role** | "Only admins can list users" | Straight away, you only need the user |
| **By ownership** | "Only the owner can delete a note" | Only after loading the note from the database |

### Role check: a middleware

```js
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You don't have permission" });
    }
    next();
  };
}

app.get("/api/admin/users", requireLogin, requireRole("admin"), handler);
```

Reads left to right: first prove who you are, then prove you're an admin, then you reach the handler. `requireRole` relies on `req.user`, so it **must come after** `requireLogin`.

### Ownership check: a small function

```js
function canAccess(user, note) {
  return user.role === "admin" || note.ownerId === user.id;
}
```

Every note route calls this one function. If the rule ever changes ("teammates can read too"), you change it in **one place**, not in ten routes.

## 4. How it works underneath

There's no magic. Authorization is an `if` statement that runs **on the server, on every request**:

```
request -> requireLogin (who?) -> requireRole / canAccess (allowed?) -> do the work
              | no                    | no
             401                    403 / 404
```

Three rules that make it actually safe:

**a) The owner comes from the token, never from the body.**

```js
// GOOD
const note = { ownerId: req.user.id, text };
// BAD: Ravi sends {"text":"hi","ownerId":1} and creates a note as Asha
const note = { ownerId: req.body.ownerId, text };
```

**b) Lists are filtered, not just single items.**

```js
notes.filter((n) => canAccess(req.user, n));
```

People remember to protect `GET /notes/:id` and forget that `GET /notes` returns everyone's.

**c) Read the role from the database, not from the token.**

If you put `role: "admin"` inside the JWT and later demote that person, their old token keeps saying `admin` until it expires (topic 08, section 6). In `example.js` the token only holds `sub`, and `requireLogin` looks up the current role each time. Promote or demote someone, and it applies on their **next** request.

Hiding a button in the frontend is **not** authorization. Anyone can call the API with curl, as you're about to.

## 5. 403 or 404?

When Ravi asks for Asha's note, which do you reply?

| Reply | Tells Ravi | Use when |
|---|---|---|
| `403 Forbidden` | "It exists, but you can't have it" | The existence isn't secret (admin pages, a shared doc you lack access to) |
| `404 Not Found` | "Nothing here" | Private things. Ravi shouldn't even learn that note 1 exists. |

`example.js` uses **404** for other people's notes and **403** for admin routes. GitHub does the same: a private repo you can't see shows 404, not 403.

## 6. The classic bug: IDOR

**IDOR** = Insecure Direct Object Reference. In plain words: "change the number in the URL, get someone else's stuff."

```js
// Logged in? Checked. Owner? Never checked.
app.get("/api/broken/notes/:id", requireLogin, (req, res) => {
  const note = notes.find((n) => n.id === Number(req.params.id));
  res.json(note);
});
```

Ravi logs in, requests `/api/broken/notes/1`, and reads Asha's shopping list. Real companies have leaked millions of records this way: invoices, medical files, private messages. It's #1 on the OWASP Top 10 ("Broken Access Control").

## 7. Options and when to pick which

| Approach | Plain words | Pick it when |
|---|---|---|
| **Ownership only** | "Your stuff is yours" | Personal apps: notes, todo lists |
| **Roles (RBAC)** | user / editor / admin, each role has fixed powers | Most apps. Start here. |
| **Permissions** | Roles map to fine-grained powers like `notes:delete` | Many roles, or admins who create custom roles |
| **Per-resource sharing (ACL)** | "Asha shared this doc with Ravi as viewer" | Google Docs style sharing |
| **Policy engines** (CASL, Casbin, OPA) | Rules written as data, checked by a library | Big apps with complicated rules |

Start with roles + ownership. Move up only when the rules hurt.

## 8. Try it

**Reading the curl commands:** a curl command is a letter to the server.

| Piece | Flag | Example |
|---|---|---|
| Address | just the URL | `localhost:3000/api/notes` |
| Method | `-X` | `-X DELETE` (no `-X` = GET, `-d` alone = POST) |
| Header (label on the envelope) | `-H` | `-H "Authorization: Bearer $A"` |
| Body (content) | `-d` | `-d '{"text":"hi"}'` |

Start the server:

```bash
cd 03-backend-core/09-authorization
JWT_SECRET=dev-secret-change-me node example.js
```

In a second terminal, log in as all three users (password is `123456789` for everyone) and save each token:

```bash
login() { curl -s localhost:3000/api/login -H 'Content-Type: application/json' -d "{\"email\":\"$1@example.com\",\"password\":\"123456789\"}" | jq -r .token; }
A=$(login asha)
R=$(login ravi)
AD=$(login admin)
```

`login` is a tiny shell function so you don't type the long command three times.

| Command | Result |
|---|---|
| `curl localhost:3000/api/notes` | 401, not logged in |
| `curl localhost:3000/api/notes -H "Authorization: Bearer $A"` | Asha's 2 notes only |
| `curl localhost:3000/api/notes -H "Authorization: Bearer $R"` | Ravi's 1 note only |
| `curl localhost:3000/api/notes/1 -H "Authorization: Bearer $R"` | 404, Ravi can't see Asha's note |
| `curl localhost:3000/api/broken/notes/1 -H "Authorization: Bearer $R"` | **200, Asha's shopping list.** The IDOR bug. |
| `curl -X DELETE localhost:3000/api/notes/1 -H "Authorization: Bearer $R"` | 404, can't delete it either |
| `curl localhost:3000/api/admin/users -H "Authorization: Bearer $A"` | 403, Asha isn't an admin |
| `curl localhost:3000/api/admin/users -H "Authorization: Bearer $AD"` | 200, all users, no password hashes |
| `curl localhost:3000/api/notes -H "Authorization: Bearer $AD"` | All 3 notes, admins see everything |
| `curl -X PATCH localhost:3000/api/admin/users/1/role -H 'Content-Type: application/json' -H "Authorization: Bearer $AD" -d '{"role":"admin"}'` | Asha is now admin |
| `curl localhost:3000/api/admin/users -H "Authorization: Bearer $A"` | **200 with her old token.** Role is read from the DB. |
| `curl localhost:3000/api/notes -H 'Content-Type: application/json' -H "Authorization: Bearer $R" -d '{"text":"hi","ownerId":1}'` | 201, but `ownerId` is **2**. The body's ownerId is ignored. |

## 9. Common mistakes

| Mistake | What happens |
|---|---|
| Checking login but not ownership | IDOR: anyone reads anyone's data by changing the id |
| Taking `ownerId` / `userId` / `role` from the request body | Users create things as someone else, or make themselves admin |
| Protecting `GET /notes/:id` but not `GET /notes` | The list leaks everything |
| Protecting `GET` but forgetting `PUT` / `DELETE` | People can't read your note but can delete it |
| Only hiding the button in the frontend | curl doesn't care about your buttons |
| `requireRole` before `requireLogin` | `req.user` is undefined, server crashes with 500 |
| Role stored in a long-lived JWT | Demoted admins stay admins until the token expires |
| Copy-pasting the `if` into every route | One day one route misses it. Use one function like `canAccess`. |

## 10. Check yourself

<details>
<summary>1. Asha has no token. Ravi has a token but asks for Asha's note. What status does each get, and why are they different?</summary>

Asha gets **401**: the server doesn't know who she is. Ravi gets **404** (or 403): the server knows exactly who he is, he's just not allowed. 401 = "who are you?", 403 = "I know who you are, and no."
</details>

<details>
<summary>2. Why does <code>example.js</code> answer 404 instead of 403 when Ravi asks for note 1?</summary>

A 403 would confirm that note 1 exists. With 404, Ravi can't tell "doesn't exist" from "not yours", so he learns nothing about other people's data.
</details>

<details>
<summary>3. The frontend never shows a "delete" button on other people's notes. Is the API safe?</summary>

No. Anyone can send `curl -X DELETE .../notes/1` directly. The check has to be on the server.
</details>

<details>
<summary>4. In <code>POST /api/notes</code>, what goes wrong if we use <code>req.body.ownerId</code>?</summary>

The client chooses the owner. Ravi can create notes that look like Asha wrote them. The owner must come from `req.user.id`, which comes from the verified token.
</details>

<details>
<summary>5. An admin is fired and demoted to "user". With role inside the JWT vs role read from the DB, when do they lose admin access?</summary>

Role in JWT: only when their token expires, because the token still says `admin`. Role from DB: on their very next request.
</details>
