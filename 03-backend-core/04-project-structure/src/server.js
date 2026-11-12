// Starts the server. The only file that opens a port.
const app = require("./app");

const PORT = 3000;

app.listen(PORT, () => {
  console.log("Listening on port " + PORT);
});
