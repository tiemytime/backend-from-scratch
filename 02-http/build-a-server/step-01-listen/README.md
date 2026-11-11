# Step 1: A server that only listens

[All steps](../) · [Step 2 →](../step-02-reply/)

## In plain words: Open the shop

We unlocked the door (port 3000) and sat behind the counter. When a customer came in and spoke, we **heard** them and wrote down what they said.

But we never answered. The customer just stood there waiting forever. That's why curl hung.

## Run it

```bash
cd 02-http/build-a-server/step-01-listen
node server.js
```

Full code: [`server.js`](./server.js)

## How it works

```js
const net = require("net");

const server = net.createServer((socket) => {
  console.log("Someone connected!");

  socket.on("data", (data) => {
    console.log("---- They sent: ----");
    console.log(data.toString());
  });
});

server.listen(3000, () => {
  console.log("Listening on port 3000");
});
```

| Code | In plain words |
|---|---|
| `require("net")` | Load Node's raw connection tool (TCP). No HTTP, just a pipe for bytes. |
| `net.createServer((socket) => ...)` | "When someone connects, run this." `socket` = the phone line to that person. |
| `socket.on("data", ...)` | "When bytes arrive on this line, run this." |
| `data.toString()` | Raw bytes → readable text |
| `server.listen(3000)` | Open door number 3000 (the port) and wait |

In a second terminal:

```bash
curl http://localhost:3000      # localhost = my own computer
```

The server terminal prints:

```
Listening on port 3000
Someone connected!
---- They sent: ----
GET / HTTP/1.1
Host: localhost:3000
User-Agent: curl/8.22.0
Accept: */*
```

**That's a raw HTTP request.** Plain text. (HTTP/1.1, not HTTP/2, because there's no HTTPS here.)

**curl hangs. Why?** The server received the request but **never answered**. Like picking up a call and staying silent.

### Lessons from mistakes along the way
- `Could not connect to server` → **nobody is listening on that port.** Usually: the server isn't running.
- `node server.js` exits instantly with no output → the file was empty (not saved).
- `SyntaxError: Unexpected token '~'` → non-JS text (shell commands) got pasted into the file.
- Code changes only apply after restarting the server (Ctrl+C, then `node server.js`).

---

[All steps](../) · [Step 2 →](../step-02-reply/)
