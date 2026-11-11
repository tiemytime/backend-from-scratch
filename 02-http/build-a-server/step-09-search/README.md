# Step 9: Search with a query string

[← Step 8](../step-08-crud/) · [All steps](../)

## In plain words: Search

Customers can attach a **sticky note** to the address:

```
/api/notes?search=milk
```

"Give me notes, but only the ones about milk." Google does the same: `google.com/search?q=cats`.

- The part before `?` is the **path**: *which* thing you want.
- The part after `?` is the **query string**: extra wishes.

**The problem:** our server compared the whole address, sticky note included, so `/api/notes?search=milk` didn't match `/api/notes` and got a 404.

**The fix:** an address-cutter (`URL`) peels the sticky note off first. The server checks the clean path, then reads the sticky note separately.

**Capital letters:** to a computer, `B` and `b` are different letters, so searching "buy" didn't find "Buy milk". We turn **both** the search word and each note into small letters before comparing.

## Run it

```bash
cd 02-http/build-a-server/step-09-search
node server.js
```

Full code: [`server.js`](./server.js)

## How it works

```
/api/notes?search=milk
```

| Part | Name | Meaning |
|---|---|---|
| `/api/notes` | **path** | which thing you want |
| `?` | | extra wishes start here |
| `search=milk` | **query string** | a wish: name `search`, value `milk` |

Several wishes: `?search=milk&limit=5`. Google does the same: `google.com/search?q=cats`.

**The problem:** `req.url` is now `"/api/notes?search=milk"`, which is not exactly `"/api/notes"`, so the route gives 404. And `/api/notes/4?x=1` splits into `"4?x=1"`, not a number.

**The fix:** peel the query string off first with `URL`, and route on `path` everywhere.

```js
const url = new URL(req.url, "http://localhost");  // URL wants a full address
const path = url.pathname;                          // "/api/notes"
url.searchParams.get("search");                     // "milk", or null if not given
```

```js
} else if (req.method === "GET" && path === "/api/notes") {
  const search = url.searchParams.get("search");
  if (!search) {
    sendJson(res, 200, notes);
  } else {
    const word = search.toLowerCase();
    const matches = notes.filter((n) => n.text.toLowerCase().includes(word));
    sendJson(res, 200, matches);
  }
}
```

| Code | In plain words |
|---|---|
| `"Buy milk".includes("milk")` | Does this text contain that text? |
| `.toLowerCase()` | Make everything small letters |

`includes` is **case-sensitive**: `"Buy milk".includes("buy")` is `false`. Lowercase **both sides** so `buy`, `Buy`, `BUY` all match.

In zsh, put addresses with `?` in quotes: `curl "localhost:3000/api/notes?search=milk"`.

### Lessons from mistakes along the way
- Blanks like `_______` in an exercise are for **replacing**. Left in, Node reads it as a name: `ReferenceError: _______ is not defined`.
- `filter((n) => matches)` → the part after `=>` must be a **question about `n`** that gives true/false, not the list itself.
- `curl: (52) Empty reply from server` → the server crashed mid-request (no `try/catch` around it). Check the server terminal.
- Reading an error: **file:line**, the `^` arrow points at the spot, the last line says what kind of problem.

---

[← Step 8](../step-08-crud/) · [All steps](../)
