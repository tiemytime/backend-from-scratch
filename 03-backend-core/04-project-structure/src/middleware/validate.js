const { z } = require("zod");

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: result.error.issues.map((issue) => ({
          field: issue.path.join(".") || "(body)",
          message: issue.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}

const idSchema = z.coerce.number().int().positive();

function validateId(req, res, next) {
  const result = idSchema.safeParse(req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: "id must be a positive whole number" });
  }
  req.noteId = result.data;
  next();
}

module.exports = { validateBody, validateId };
