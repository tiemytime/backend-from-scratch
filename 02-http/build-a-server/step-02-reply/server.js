const net = require("net");

const server = net.createServer((socket) => {
  console.log("Someone connected!");

  socket.on("data", (data) => {
    console.log("---- They sent: ----");
    console.log(data.toString());
    socket.write("HTTP/1.1 200 OK\r\n");
    socket.write("\r\n");
    socket.write("Hello from my server\n");
    socket.end();
  });
});

server.listen(3000, () => {
  console.log("Listening on port 3000");
});
