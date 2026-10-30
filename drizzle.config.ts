// Drizzle Kit (#14): `npm run db:generate` writes a migration to `drizzle/` after a change of `src/db/schema.ts`.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_PATH || "./data/tumach.db" },
});
