// What correct note data looks like.
const { z } = require("zod");

const text = z
  .string({
    error: (issue) => (issue.input === undefined ? "text is required" : "text must be a string"),
  })
  .trim()
  .min(1, { error: "text can't be empty" })
  .max(200, { error: "text must be 200 characters or less" });

const pinned = z.boolean({ error: "pinned must be true or false" });

const createNoteSchema = z.strictObject({
  text: text,
  pinned: pinned.default(false),
});

const updateNoteSchema = z.strictObject({
  text: text.optional(),
  pinned: pinned.optional(),
});

module.exports = { createNoteSchema, updateNoteSchema };
