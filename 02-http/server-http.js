const http = require("http");
const fs = require("fs");

const FILE = __dirname + "/notes.json";

function loadNotes() {
  if (!fs.existsSync(FILE)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function saveNotes() {
  fs.writeFileSync(FILE, JSON.stringify(notes, null, 2));
}

function send(res, status, contentType, body) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, "application/json", JSON.stringify(data));
}

function readBody(req, callback) {
  let requestBody = "";
  req.on("data", (chunk) => {
    requestBody += chunk;
  });
  req.on("end", () => {
    callback(requestBody);
  });
}

let notes = loadNotes();
console.log("Loaded", notes.length, "notes from disk");

const server = http.createServer((req, res) => {
  console.log(req.method, req.url);
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  if (path === "/") {
    send(res, 200, "text/plain", "Home page\n");
  } else if (path === "/about") {
    send(res, 200, "text/plain", "About: this server is built from scratch\n");
  } else if (req.method === "GET" && path === "/api/notes") {
    const search = url.searchParams.get("search");
    if (!search) {
      sendJson(res, 200, notes);
    } else {
      const word = search.toLowerCase();
      const matches = notes.filter((n) => n.text.toLowerCase().includes(word));
      sendJson(res, 200, matches);
    }
  } else if (req.method === "POST" && path === "/api/notes") {
    readBody(req, (requestBody) => {
      try {
        const input = JSON.parse(requestBody);
        const nextId = Math.max(0, ...notes.map((n) => n.id)) + 1;
        const note = { id: nextId, text: input.text };
        notes.push(note);
        saveNotes();
        sendJson(res, 201, note);
      } catch (err) {
        console.log(err);
        sendJson(res, 400, { error: "Bad JSON" });
      }
    });
  } else if (path.startsWith("/api/notes/")) {
    const id = Number(path.split("/")[3]);
    const note = notes.find((n) => n.id === id);

    if (!note) {
      sendJson(res, 404, { error: "No such note" });
    } else if (req.method === "GET") {
      sendJson(res, 200, note);
    } else if (req.method === "PUT") {
      readBody(req, (requestBody) => {
        try {
          const input = JSON.parse(requestBody);
          note.text = input.text;
          saveNotes();
          sendJson(res, 200, note);
        } catch (err) {
          console.log(err);
          sendJson(res, 400, { error: "Bad JSON" });
        }
      });
    } else if (req.method === "DELETE") {
      notes = notes.filter((n) => n.id !== id);
      saveNotes();
      send(res, 204, "text/plain", "");
    } else {
      send(res, 405, "text/plain", "Method not allowed\n");
    }
  } else {
    send(res, 404, "text/plain", "Nothing here\n");
  }
});

server.listen(3000, () => {
  console.log("Listening on port 3000");
});
