# Step 4: Send JSON

[← Step 3](../step-03-routing/) · [All steps](../) · [Step 5 →](../step-05-post/)

## In plain words: Answers that apps can read

Plain text is fine for people. Apps need answers in a strict, tidy format, so we answer in **JSON**. Every answer also carries two labels:

- **what kind of answer it is** (Content-Type: text or JSON)
- **how big it is** (Content-Length), so the customer knows when we've finished talking

## Run it

```bash
cd 02-http/build-a-server/step-04-json
node server.js
```

Full code: [`server.js`](./server.js)

## How it works

Apps talk to servers in **JSON**, text that code can read. Add a route that returns a list:

```js
const notes = [
  { id: 1, text: "Learn HTTP" },
  { id: 2, text: "Build a server" },
];

// inside the if/else:
} else if (path === "/api/notes") {
  contentType = "application/json";
  body = JSON.stringify(notes);
}

// when replying:
socket.write("Content-Type: " + contentType + "\r\n");
socket.write("Content-Length: " + Buffer.byteLength(body) + "\r\n");
```

| Code | In plain words |
|---|---|
| `notes` | A list kept in memory. A pretend database (gone when the server restarts). |
| `JSON.stringify(notes)` | JS list → JSON text that can travel over the wire |
| `Content-Type: application/json` | "This body is JSON, not plain text" |
| `Content-Length` | "The body is exactly N **bytes**", so the client knows when it ends |
| `Buffer.byteLength(body)` | Count bytes, not letters (an emoji = 1 letter, 4 bytes) |

```
$ curl -i localhost:3000/api/notes
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 63

[{"id":1,"text":"Learn HTTP"},{"id":2,"text":"Build a server"}]%
```

- `Home page\n` has Content-Length 10: 9 visible characters + the invisible `\n`.
- **That `%` at the end** is zsh saying "this output didn't end with a new line". `JSON.stringify` doesn't add `\n`. Not an error; JSON doesn't need one.
- Open `/api/notes` in Firefox: it detects the JSON and shows a viewer.

---

[← Step 3](../step-03-routing/) · [All steps](../) · [Step 5 →](../step-05-post/)
