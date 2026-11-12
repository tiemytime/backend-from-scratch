// The menu: which URL goes to which controller, and which guards stand in front.
const express = require("express");
const notesController = require("../controllers/notes.controller");
const { validateBody, validateId } = require("../middleware/validate");
const { createNoteSchema, updateNoteSchema } = require("../schemas/notes.schema");

const router = express.Router();

router.get("/", notesController.list);
router.post("/", validateBody(createNoteSchema), notesController.create);
router.get("/:id", validateId, notesController.getOne);
router.patch("/:id", validateId, validateBody(updateNoteSchema), notesController.update);
router.delete("/:id", validateId, notesController.remove);

module.exports = router;
