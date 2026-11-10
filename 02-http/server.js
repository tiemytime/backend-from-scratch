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
