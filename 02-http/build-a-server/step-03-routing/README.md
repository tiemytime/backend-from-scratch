# Step 3: Different pages for different paths

[← Step 2](../step-02-reply/) · [All steps](../) · [Step 4 →](../step-04-json/)

## In plain words: Different answers for different questions

Before, we said "Hello" to everyone, whatever they asked. Now we listen to **what** they want:

- Ask for the home page, get the home page.
- Ask for "about", get the about page.
- Ask for "banana", get **"we don't have that" (404)**.

Picking the answer based on what was asked is called **routing**.

## Run it

```bash
cd 02-http/build-a-server/step-03-routing
node server.js
```

Full code: [`server.js`](./server.js)

## How it works

The path lives in the request's first line: `GET /about HTTP/1.1`. Cut it at the spaces to get it.

```js
const firstLine = request.split("\r\n")[0];
const [method, path] = firstLine.split(" ");

if (path === "/") {
  body = "Home page\n";
} else if (path === "/about") {
  body = "About: this server is built from scratch\n";
} else {
  status = "404 Not Found";
  body = "Nothing here\n";
}
```

| Code | In plain words |
|---|---|
| `split("\r\n")[0]` | Cut request into lines, keep the first |
| `split(" ")` | Cut `GET /about HTTP/1.1` into 3 pieces |
| `const [method, path]` | Name the first two pieces |
| `if / else` | Pick the reply based on the path. This is **routing**. |
| `404 Not Found` | "That page doesn't exist" |

Try it (`-i` shows status line + headers):

```bash
curl -i localhost:3000/          # 200 OK, Home page
curl -i localhost:3000/about     # 200 OK, About...
curl -i localhost:3000/banana    # 404 Not Found
```

**This is all Express does underneath** `app.get("/about", ...)`: read the first line, compare the path, write a reply.

---

[← Step 2](../step-02-reply/) · [All steps](../) · [Step 4 →](../step-04-json/)
