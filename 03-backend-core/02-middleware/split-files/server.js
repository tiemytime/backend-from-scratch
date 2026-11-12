// The ORDER of app.use lines in THIS file decides the flow.
const express = require("express");
const { requestId, logger, requireAdmin, notFound, errorHandler } = require("./middleware");

const app = express();

app.use(requestId);
app.use(logger);
app.use(express.json());
app.use("/admin", requireAdmin);

app.get("/api/notes", (req, res) => {
  res.json([{ id: 1, text: "Buy milk" }]);
});

app.get("/admin/stats", (req, res) => {
  res.json({ notes: 1 });
});

app.use(notFound);
app.use(errorHandler);

app.listen(3000, () => {
  console.log("Listening on port 3000");
});
