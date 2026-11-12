// The ONE place that reads environment variables.
// Everything else does: const config = require("./config");
const { z } = require("zod");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  ADMIN_KEY: z
    .string({ error: "ADMIN_KEY is required" })
    .min(8, { error: "ADMIN_KEY must be at least 8 characters" }),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("❌ Bad config. Fix your .env file:");
  for (const issue of result.error.issues) {
    console.error("  -", issue.path.join("."), ":", issue.message);
  }
  process.exit(1);
}

const env = result.data;

module.exports = {
  env: env.NODE_ENV,
  port: env.PORT,
  adminKey: env.ADMIN_KEY,
};
