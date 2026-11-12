// Builds the app: which guards, in which order, which routers.
const express = require("express");
const logger = require("./middleware/logger");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const notesRoutes = require("./routes/notes.routes");

const app = express();

app.use(logger);
app.use(express.json());

app.use("/api/notes", notesRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
