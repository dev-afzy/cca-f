import path from "node:path";
import os from "node:os";
import { defineConfig } from "prisma/config";

const dbPath = path.join(os.homedir(), ".cca-f-tutor", "cca-f.db");

// Migrations target Turso when TURSO_DATABASE_URL is set (include ?authToken=...
// in the URL for the migrate engine), else the local SQLite file. NOTE: applying
// migrations to Turso is most reliable via the Turso CLI —
// `turso db shell <db> < prisma/migrations/<name>/migration.sql` — see the
// deploy checklist; `prisma migrate deploy` against remote libsql has known friction.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.TURSO_DATABASE_URL ?? `file:${dbPath}`,
  },
});
