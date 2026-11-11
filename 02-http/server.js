  const net = require("net");
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

  const notes = loadNotes();
  console.log("Loaded", notes.length, "notes from disk");

  const server = net.createServer((socket) => {
    socket.on("data", (data) => {
      const request = data.toString();
      const [head, requestBody] = request.split("\r\n\r\n");
      const firstLine = head.split("\r\n")[0];
      const [method, path] = firstLine.split(" ");
      console.log(method, path);

      let status = "200 OK";
      let contentType = "text/plain";
      let body = "";

      if (path === "/") {
        body = "Home page\n";
      } else if (path === "/about") {
        body = "About: this server is built from scratch\n";
      } else if (method === "GET" && path === "/api/notes") {
        contentType = "application/json";
        body = JSON.stringify(notes);
      } else if (method === "POST" && path === "/api/notes") {
        contentType = "application/json";
        try {
          const input = JSON.parse(requestBody);
          const note = { id: notes.length + 1, text: input.text };
          notes.push(note);
          saveNotes();
          status = "201 Created";
          body = JSON.stringify(note);
        } catch (err) {
          status = "400 Bad Request";
          body = JSON.stringify({ error: "Body must be valid JSON" });
        }
      } else {
        status = "404 Not Found";
        body = "Nothing here\n";
      }

      socket.write("HTTP/1.1 " + status + "\r\n");
      socket.write("Content-Type: " + contentType + "\r\n");
      socket.write("Content-Length: " + Buffer.byteLength(body) + "\r\n");
      socket.write("\r\n");
      socket.write(body);
      socket.end();
    });
  });

  server.listen(3000, () => {
    console.log("Listening on port 3000");
  });
