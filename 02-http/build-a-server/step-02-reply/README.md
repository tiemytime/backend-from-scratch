# Step 2: Send a reply

[← Step 1](../step-01-listen/) · [All steps](../) · [Step 3 →](../step-03-routing/)

## In plain words: Learn to answer

Now when someone asks, we reply in the shop's official format:

1. "OK" (the **status**)
2. a few labels about the answer (the **headers**)
3. a blank pause (an empty line)
4. the actual answer (the **body**)

Then we say goodbye and close the conversation.

## Run it

```bash
cd 02-http/build-a-server/step-02-reply
node server.js
```

Full code: [`server.js`](./server.js)

## How it works

Add these lines inside `socket.on("data", ...)`, right after the `console.log`:

```js
    socket.write("HTTP/1.1 200 OK\r\n");
    socket.write("\r\n");
    socket.write("Hello from my server\n");
    socket.end();
```

| Code | In plain words |
|---|---|
| `HTTP/1.1 200 OK` | Status line: "I understood you, all good." |
| `\r\n` alone | Empty line = "headers are done, body starts now" |
| `Hello from...` | The body. What you actually see. |
| `socket.end()` | Hang up |

`\r\n` = HTTP's "new line". Every line in a request or response ends with it.

**A response has the same shape as a request:** first line, headers, empty line, body.

Now `curl` prints the text and exits, and opening `http://localhost:3000` in a browser shows it too.

**Missing `Content-Type`?** It still worked because the browser *guessed* the type. Real servers always say it, e.g. `Content-Type: text/plain`.

### What a browser sends (vs curl)

Opening the page in Firefox sends a much bigger request:

| Header | In plain words |
|---|---|
| `User-Agent` | "I'm Firefox on Linux" |
| `Accept` | "I prefer HTML, but anything (`*/*`) is fine" |
| `Accept-Encoding: gzip, ...` | "You can compress the reply" |
| `Connection: keep-alive` | "Keep this line open for more requests" |
| `Cookie` | **Every cookie saved for `localhost`** |

**Cookie lesson:** cookies belong to the **host name, not the port**. `localhost:3000` and `localhost:5173` share cookies. So any app you run on localhost receives login tokens from every other localhost project. Never paste the `Cookie:` line anywhere public.

---

[← Step 1](../step-01-listen/) · [All steps](../) · [Step 3 →](../step-03-routing/)
