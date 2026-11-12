# Validation

[← Middleware](../02-middleware/) · [Backend core](../) · [Project structure →](../04-project-structure/)

## 1. The problem

Right now our notes API saves **anything** it's given:

```bash
curl localhost:3000/api/notes -H 'Content-Type: application/json' -d '{"text": ""}'          # empty note
curl localhost:3000/api/notes -H 'Content-Type: application/json' -d '{"text": 12345}'       # a number
curl localhost:3000/api/notes -H 'Content-Type: application/json' -d '{}'                    # no text at all
curl localhost:3000/api/notes -H 'Content-Type: application/json' -d '{"isAdmin": true}'     # extra junk
```

All of these get saved. Then later, code like `note.text.toLowerCase()` crashes, because `text` is a number or missing. One bad request today becomes a broken app tomorrow.

**Validation means checking that data is correct before you use it.**

## 2. In plain words

A bank teller doesn't accept a deposit slip with the amount left blank, a name written as "12345", or an amount of "-500". They check the slip **at the counter**, before it goes into the system. If something is wrong, they hand it back and say exactly which box to fix.

Your server is the teller. The request body is the slip.

## 3. The golden rule: never trust the client

> Everything that comes from outside your server can be wrong or fake.

"But my frontend form already checks the text isn't empty!" That doesn't matter. Anyone can skip your website and send requests directly with `curl`, Postman, or a script, which is exactly what you've been doing all along.

| Check in the... | Purpose | Can it be skipped? |
|---|---|---|
| **Frontend** (browser form) | Nice experience: show "required" instantly | Yes, easily |
| **Backend** (server) | Safety: protect your data | No |

So: frontend validation is **for the user's comfort**, backend validation is **for your safety**. You always need the backend one.

## 4. What to check

| Check | Example | Bad input it catches |
|---|---|---|
| **Required** | `text` must exist | `{}` |
| **Type** | `text` is a string, `pinned` is true/false | `{"text": 12345}`, `{"pinned": "yes"}` |
| **Length / size** | `text` is 1 to 200 characters | `""`, a 5 MB essay |
| **Range** | `quantity` is 1 to 10 | `-5`, `99999` |
| **Format** | email looks like an email, id is a whole number | `"abc"` as an email, `/notes/abc` |
| **Allowed values** | `status` is `"todo"`, `"doing"` or `"done"` | `"banana"` |
| **No unknown fields** | only `text` and `pinned` allowed | `{"text": "hi", "isAdmin": true}` |

**Why reject unknown fields?** Imagine a user signup route that saves `req.body` straight into the database. Someone sends `{"email": "...", "password": "...", "isAdmin": true}`. If you don't reject or strip extra fields, they just made themselves an admin. This attack is called **mass assignment**.

And it's not only the body. **Anything** from the request needs checking:

| Where | Example | Check |
|---|---|---|
| `req.body` | `{"text": "hi"}` | shape, types, lengths |
| `req.params` | `/api/notes/abc` | id is a positive whole number |
| `req.query` | `?search=...&page=-1` | page is a positive number, search isn't 10,000 characters |
| headers | `X-Admin-Key` | present and correct |

## 5. Validate vs clean up

Two related jobs:

- **Validate:** "Is this acceptable?" Yes or no.
- **Clean up** (sanitize / normalize): "Make it tidy." Trim spaces, lowercase an email, fill in defaults.

`"  Call mom  "` becomes `"Call mom"`. Then `"     "` (only spaces) becomes `""`, which fails the "not empty" rule. So **clean first, then check**.

## 6. Step 1: validating by hand

[`by-hand.js`](./by-hand.js) does it with plain `if` statements, no library:

```js
function validateNote(body) {
  const errors = [];

  if (typeof body !== "object" || body === null) {
    return ["body must be a JSON object"];
  }
  if (body.text === undefined) {
    errors.push("text is required");
  } else if (typeof body.text !== "string") {
    errors.push("text must be a string");
  } else if (body.text.trim().length === 0) {
    errors.push("text can't be empty");
  } else if (body.text.length > 200) {
    errors.push("text must be 200 characters or less");
  }

  if (body.pinned !== undefined && typeof body.pinned !== "boolean") {
    errors.push("pinned must be true or false");
  }

  return errors;
}
```

```bash
node by-hand.js
```

```
✅ {"text":"Buy milk"} []
❌ {} [ 'text is required' ]
❌ {"text":""} [ "text can't be empty" ]
❌ {"text":"    "} [ "text can't be empty" ]
❌ {"text":12345} [ 'text must be a string' ]
❌ {"text":"ok","pinned":"yes"} [ 'pinned must be true or false' ]
❌ null [ 'body must be a JSON object' ]
```

- `typeof x` gives `"string"`, `"number"`, `"boolean"`, `"object"`...
- `body === null` is checked separately because, as an old JavaScript quirk, `typeof null` is `"object"`.
- We collect **all** the errors in a list, so the user can fix everything at once instead of one error per try.

It works, but it's **20 lines for 2 fields**. A signup form with 10 fields would be 100 lines of `if`s, and it's easy to miss a case (this version doesn't even reject unknown fields). That's why people use a library.

## 7. Step 2: a schema library (zod)

A **schema** is a description of what correct data looks like. You describe the shape once, and the library does all the checking.

```bash
pnpm add zod
```

```js
const { z } = require("zod");

const text = z
  .string({
    error: (issue) => (issue.input === undefined ? "text is required" : "text must be a string"),
  })
  .trim()
  .min(1, { error: "text can't be empty" })
  .max(200, { error: "text must be 200 characters or less" });

const pinned = z.boolean({ error: "pinned must be true or false" });

const createNoteSchema = z.strictObject({
  text: text,
  pinned: pinned.default(false),
});
```

Read it like a sentence:

| Code | Means |
|---|---|
| `z.string()` | must be a string |
| `.trim()` | clean: remove spaces at both ends |
| `.min(1)` | then: at least 1 character |
| `.max(200)` | at most 200 characters |
| `z.boolean()` | must be `true` or `false` |
| `.default(false)` | if it's missing, use `false` |
| `.optional()` | allowed to be missing |
| `z.strictObject({...})` | an object with **only** these fields, anything extra is an error |
| `{ error: "..." }` | the message to show when this rule fails |

**Using it:**

```js
const result = createNoteSchema.safeParse(req.body);

if (!result.success) {
  // result.error.issues is the list of what's wrong
} else {
  // result.data is the cleaned data: trimmed, defaults filled in
}
```

- `safeParse` **never throws**. It returns `{ success: true, data }` or `{ success: false, error }`.
- `parse` (without "safe") **throws** on bad data. Fine too, if your error handler deals with it.
- Always use **`result.data`** afterwards, not the original `req.body`. Only `result.data` is trimmed and has defaults filled in.

### Other schema libraries

| Library | Language | Notes |
|---|---|---|
| **zod** | JavaScript / TypeScript | Most popular today, works great with TypeScript |
| joi | JavaScript | Older, used in many existing Express apps |
| yup | JavaScript | Popular with frontend forms |
| express-validator | JavaScript | Validation written as Express middleware |
| **pydantic** | Python | FastAPI uses it built in. The same idea as zod. |

Learn the idea once (describe the shape, check it, use the cleaned data) and every library is just new spelling.

## 8. Step 3: validation as middleware

Validation is a guard, so it fits perfectly as [middleware](../02-middleware/). We write **one** function that works for **any** schema:

```js
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: result.error.issues.map((issue) => ({
          field: issue.path.join(".") || "(body)",
          message: issue.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}
```

**A function that returns a middleware.** `validateBody(createNoteSchema)` doesn't check anything yet. It **builds** a guard that knows which schema to use. That's why this one is written with `()` while `app.use(logger)` isn't:

```js
app.post("/api/notes", validateBody(createNoteSchema), (req, res) => {
  const note = { id: nextId, ...req.body };   // safe: already checked and cleaned
  ...
});
```

- `issue.path` is where the problem is, e.g. `["text"]`. `join(".")` makes `"text"`, or `"address.city"` for nested fields. Problems with the whole body have an empty path, so we show `"(body)"`.
- `req.body = result.data` swaps the raw body for the cleaned one, so the route never sees untrimmed or unchecked data.
- **The route doesn't contain a single `if` about the input.** The guard handled it, just like auth in the middleware notes.

### Validating the id in the URL

```js
const idSchema = z.coerce.number().int().positive();

function validateId(req, res, next) {
  const result = idSchema.safeParse(req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: "id must be a positive whole number" });
  }
  req.noteId = result.data;
  next();
}
```

- `z.coerce.number()` means "turn it into a number first". URL parts are always text (`"7"`), so this does the job of `Number(req.params.id)`.
- `.int()` rejects `1.5`. `.positive()` rejects `0` and `-3`.
- Before this, `/api/notes/abc` became `Number("abc")`, which is `NaN`, and gave a confusing "No such note" 404. Now it's a clear 400: your request is wrong, not missing.

You can stack guards:

```js
app.patch("/api/notes/:id", validateId, validateBody(updateNoteSchema), (req, res) => { ... });
```

## 9. Create vs update need different schemas

| | Create (POST) | Update (PATCH) |
|---|---|---|
| `text` | required | optional, change only if sent |
| `pinned` | optional, default `false` | optional, **no default** |

```js
const updateNoteSchema = z.strictObject({
  text: text.optional(),
  pinned: pinned.optional(),
});
```

**A real bug we hit while building this example:** we first wrote `createNoteSchema.partial()` ("same schema, but everything optional"). The `default(false)` came along with it. So `PATCH {"text": "new text"}` quietly **set `pinned` back to `false`** on a pinned note. Defaults belong on create, never on update.

**PUT vs PATCH:** PUT means "replace the whole note" (send every field). PATCH means "change only these fields". For editing one field, PATCH is the honest choice.

## 10. Good error responses

Bad:
```json
{ "error": "Bad request" }
```
The user has no idea what to fix.

Good:
```json
{
  "error": "Invalid input",
  "details": [
    { "field": "text", "message": "text can't be empty" },
    { "field": "pinned", "message": "pinned must be true or false" }
  ]
}
```

- **Which field** and **what's wrong**, so a frontend can show the message right under the right input box.
- **All** errors at once, not one per attempt.
- The **same shape** every time, so the frontend handles all errors with one piece of code.

### 400 or 422?

| Code | Meaning | Use for |
|---|---|---|
| **400** Bad Request | "I can't accept this request" | Broken JSON, wrong types, failed validation. The simple, common choice. |
| **422** Unprocessable Content | "I understood it, but the values break the rules" | Some APIs (Rails, FastAPI, GitHub) use this for validation failures specifically |

Both are fine. Pick one and **use it consistently**. We use 400.

## 11. Try it

```bash
cd 03-backend-core/03-validation
node example.js
```

| Send | Get | Why |
|---|---|---|
| `-d '{"text":"  Call mom  "}'` | 201, `"text":"Call mom","pinned":false` | trimmed, default filled in |
| `-d '{}'` | 400, `text is required` | missing |
| `-d '{"text":""}'` | 400, `text can't be empty` | too short |
| `-d '{"text":"   "}'` | 400, `text can't be empty` | trimmed first, then too short |
| `-d '{"text":12345}'` | 400, `text must be a string` | wrong type |
| `-d '{"text":"hi","pinned":"yes"}'` | 400, `pinned must be true or false` | wrong type |
| `-d '{"text":"hi","isAdmin":true}'` | 400, `Unrecognized key: "isAdmin"` | unknown field |
| `-d '[1,2]'` | 400, `expected object, received array` | wrong shape |
| no `-H 'Content-Type: ...'` | 400, `expected object, received undefined` | body never parsed |
| `curl localhost:3000/api/notes/abc` | 400, `id must be a positive whole number` | bad id |
| `curl -X PATCH .../api/notes/1 -d '{"pinned":true}'` | 200, only `pinned` changed | partial update |

(Add `-H 'Content-Type: application/json'` to every POST and PATCH above, except the one testing what happens without it.)

## 12. Real-world examples

| App | What it validates |
|---|---|
| Signup on any site | email format, password length, username allowed characters, username not taken |
| Amazon cart | quantity is a whole number from 1 to 10, product id exists |
| Bank transfer | amount is positive, has at most 2 decimals, is under your daily limit |
| Instagram post | caption at most 2,200 characters, at most 30 hashtags |
| Any list page | `?page=` is a positive number, `?limit=` is at most 100 (so nobody asks for a million rows) |

Notice two kinds of rules:

- **Shape rules** need only the data itself: is it a string, how long. A schema handles these.
- **Business rules** need your database: "is this username taken?", "is this under the daily limit?". These go in the route or service code, after the schema check.

## 13. Common mistakes

| Mistake | What happens |
|---|---|
| Validating only in the frontend | Anyone with curl saves garbage |
| Using `req.body` after validating, not `result.data` | You lose the trimming and defaults |
| Not rejecting unknown fields | Mass assignment: `"isAdmin": true` slips into the database |
| `.partial()` on a schema that has defaults | PATCH silently resets fields to their defaults |
| No maximum length | Someone saves a 50 MB "note" |
| Error says only "Bad request" | The user can't tell what to fix |
| Forgetting params and query | `/notes/abc` or `?limit=999999` hit your code unchecked |
| Showing one error at a time | The user fixes, retries, gets the next error, gives up |

## 14. Check yourself

<details>
<summary>1. The frontend already checks the text isn't empty. Why check again on the server?</summary>

Anyone can skip the frontend and send requests directly with curl or a script. Frontend checks are for comfort, backend checks are for safety.
</details>

<details>
<summary>2. Why does <code>"     "</code> fail with "can't be empty" instead of being saved?</summary>

`.trim()` runs before `.min(1)`. Trimming turns it into `""`, which has 0 characters.
</details>

<details>
<summary>3. What is mass assignment, and which line stops it?</summary>

Sending extra fields like `"isAdmin": true` that get saved because the code stores the whole body. `z.strictObject` rejects unknown fields.
</details>

<details>
<summary>4. Why <code>app.post("/x", validateBody(schema), ...)</code> with brackets, but <code>app.use(logger)</code> without?</summary>

`validateBody(schema)` is called right away to **build** a middleware for that schema, and it returns the middleware. `logger` already is the middleware, so you hand it over without calling it.
</details>

<details>
<summary>5. Why must the update schema not have defaults?</summary>

A PATCH that sends only `text` would get `pinned: false` filled in by the default and overwrite the saved value.
</details>

<details>
<summary>6. "Is this username already taken?" Schema or route?</summary>

Route (or service). It needs the database, so it's a business rule, not a shape rule.
</details>
