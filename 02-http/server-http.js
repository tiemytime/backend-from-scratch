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

  const notes = loadNotes();
  console.log("Loaded", notes.length, "notes from disk");

  const server = http.createServer((req, res) => {
    console.log(req.method, req.url);

    if (req.url === "/") {
      send(res, 200, "text/plain", "Home page\n");
    } else if (req.url === "/about") {
      send(res, 200, "text/plain", "About: this server is built from scratch\n");
    } else if (req.method === "GET" && req.url === "/api/notes") {
      send(res, 200, "application/json", JSON.stringify(notes));
    } else if (req.method === "POST" && req.url === "/api/notes") {
      let requestBody = "";
      req.on("data", (chunk) => {
        requestBody += chunk;
      });
      req.on("end", () => {
        try {
          const input = JSON.parse(requestBody);
          const note = { id: notes.length + 1, text: input.text };
          notes.push(note);
          saveNotes();
          send(res, 201, "application/json", JSON.stringify(note));
        } catch (err) {
          send(res, 400, "application/json", JSON.stringify({ error: "Body must be valid JSON" }));
        }
      });
    } else {
      send(res, 404, "text/plain", "Nothing here\n");
    }
  });

  server.listen(3000, () => {
    console.log("Listening on port 3000");
  });
