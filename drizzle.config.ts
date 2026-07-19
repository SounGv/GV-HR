import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./netlify/database/migrations",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL || "",
  },
});
