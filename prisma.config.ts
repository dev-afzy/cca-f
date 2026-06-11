import path from "node:path";
import os from "node:os";
import { defineConfig } from "prisma/config";

const dbPath = path.join(os.homedir(), ".cca-f-tutor", "cca-f.db");

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: `file:${dbPath}`,
  },
});
