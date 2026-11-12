// Validation by hand, no library. Run: node by-hand.js

function validateNote(body) {
  const errors = [];

  if (typeof body !== "object" || body === null) {
    return ["body must be a JSON object"];
  }
  if (body.text === undefined) {
    errors.push("text is required");
  } else if (typeof body.text !== "string") {
    errors.push("text must be a string");
  } else if (body.text.trim().length === 0) {
    errors.push("text can't be empty");
  } else if (body.text.length > 200) {
    errors.push("text must be 200 characters or less");
  }

  if (body.pinned !== undefined && typeof body.pinned !== "boolean") {
    errors.push("pinned must be true or false");
  }

  return errors;
}

const tries = [
  { text: "Buy milk" },
  { text: "Buy milk", pinned: true },
  {},
  { text: "" },
  { text: "    " },
  { text: 12345 },
  { text: "x".repeat(201) },
  { text: "ok", pinned: "yes" },
  null,
];

for (const body of tries) {
  const errors = validateNote(body);
  const shown = JSON.stringify(body).slice(0, 30);
  console.log(errors.length === 0 ? "✅" : "❌", shown, errors);
}
