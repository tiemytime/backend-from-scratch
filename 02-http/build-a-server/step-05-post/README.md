# Step 5: Receive data (POST)

[← Step 4](../step-04-json/) · [All steps](../) · [Step 6 →](../step-06-save-to-file/)

## In plain words: Customers can give us things

Until now customers only **asked**. Now they can **hand us a new note** (a POST request).

- We open what they handed over, add it to our list, and say **"Created" (201)**.
- If they hand us garbage, we don't panic. We say **"that's broken" (400)** and keep working.

## Run it

```bash
cd 02-http/build-a-server/step-05-post
node server.js
```

Full code: [`server.js`](./server.js)

## How it works

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

---

[← Step 4](../step-04-json/) · [All steps](../) · [Step 6 →](../step-06-save-to-file/)
