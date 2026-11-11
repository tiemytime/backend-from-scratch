const net = require("net");

const notes = [
  { id: 1, text: "Learn HTTP" },
  { id: 2, text: "Build a server" },
];

const server = net.createServer((socket) => {
  socket.on("data", (data) => {
    const request = data.toString();
    const firstLine = request.split("\r\n")[0];
    const [method, path] = firstLine.split(" ");
    console.log(method, path);

    let status = "200 OK";
    let contentType = "text/plain";
    let body = "";

    if (path === "/") {
      body = "Home page\n";
    } else if (path === "/about") {
      body = "About: this server is built from scratch\n";
    } else if (path === "/api/notes") {
      contentType = "application/json";
      body = JSON.stringify(notes);
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
