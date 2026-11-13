// CORS: which websites may call your API from a browser.
// Run: node example.js
// Then open http://localhost:5173 (allowed) and http://localhost:4000 (not allowed)
// in your browser and press the buttons. Watch this terminal while you do.
const express = require("express");

const API_PORT = Number(process.env.API_PORT) || 3000;
const GOOD_PORT = Number(process.env.GOOD_PORT) || 5173;
const EVIL_PORT = Number(process.env.EVIL_PORT) || 4000;

const API = `http://localhost:${API_PORT}`;

// The guest list. Only pages from these origins may READ our replies in a browser.
// Origin = scheme + host + port. "http://localhost:5173" and "http://localhost:4000"
// are different origins, even though both are on your laptop.
const ALLOWED_ORIGINS = [`http://localhost:${GOOD_PORT}`];

// ================= The API (port 3000) =================

const api = express();

// Logger first, so you see EVERY request that reaches the server,
// including the ones the browser will later hide from the page.
api.use((req, res, next) => {
  console.log(`[api] ${req.method.padEnd(7)} ${req.url.padEnd(12)} Origin: ${req.headers.origin || "(none, not a cross-origin browser call)"}`);
  next();
});

// CORS by hand, so you can see every header. In a real app you'd use the
// `cors` package (see notes.md section 7), which does exactly this.
function cors(req, res, next) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    // "Browser, you may show this reply to a page from <origin>."
    res.set("Access-Control-Allow-Origin", origin);
  }
  // The reply depends on the Origin header, so caches must not reuse
  // a reply meant for one site when another site asks.
  res.set("Vary", "Origin");

  // Preflight: the browser asking permission BEFORE sending the real request.
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "GET, POST, DELETE");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Max-Age", "600"); // browser may remember this answer for 10 minutes
    return res.sendStatus(204);
  }

  next();
}

api.use(cors);
api.use(express.json());

const notes = [{ id: 1, text: "Buy milk" }];

api.get("/api/notes", (req, res) => {
  res.json(notes);
});

api.post("/api/notes", (req, res) => {
  const text = req.body?.text;
  if (typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "text is required" });
  }
  const note = { id: notes.length + 1, text };
  notes.push(note);
  console.log(`[api] saved note ${note.id}: "${text}"`);
  res.status(201).json(note);
});

api.listen(API_PORT, () => console.log(`API          ${API}`));

// ================= Two websites that call the API =================

// The same page, served from two different origins. The only difference
// between the "good" and "evil" site is the port, which is enough to make
// them different origins.
function page(name, color) {
  return `<!doctype html>
<meta charset="utf-8">
<title>${name}</title>
<body style="font-family: sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px">
<h1 style="color:${color}">${name}</h1>
<p>This page lives at <b id="here"></b> and calls the API at <b>${API}</b>.</p>
<button id="get">GET /api/notes</button>
<button id="post">POST /api/notes (JSON)</button>
<pre id="out" style="background:#eee; padding:12px; white-space:pre-wrap">Press a button.</pre>
<script>
  const API = "${API}";
  const out = document.getElementById("out");
  document.getElementById("here").textContent = location.origin;

  async function call(options) {
    out.textContent = "Calling...";
    try {
      const res = await fetch(API + "/api/notes", options);
      out.textContent = "Status " + res.status + "\\n" + JSON.stringify(await res.json(), null, 2);
    } catch (err) {
      // The browser gives JavaScript no details on purpose. The real reason
      // is only in DevTools (F12) > Console.
      out.textContent = "Blocked by the browser: " + err.message +
        "\\nOpen DevTools (F12) > Console to see why.";
    }
  }

  document.getElementById("get").onclick = () => call();
  document.getElementById("post").onclick = () => call({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Hello from " + location.origin }),
  });
</script>
</body>`;
}

const good = express();
good.get("/", (req, res) => res.send(page("Notes App (allowed)", "green")));
good.listen(GOOD_PORT, () => console.log(`Good site    http://localhost:${GOOD_PORT}  (on the guest list)`));

const evil = express();
evil.get("/", (req, res) => res.send(page("Evil Site (not allowed)", "crimson")));
evil.listen(EVIL_PORT, () => console.log(`Evil site    http://localhost:${EVIL_PORT}  (not on the guest list)`));
