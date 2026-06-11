import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const dataDir = path.join(os.homedir(), ".cca-f-tutor");

console.log(`Ensuring data directory exists: ${dataDir}`);
fs.mkdirSync(dataDir, { recursive: true });

console.log("Running prisma migrate deploy...");
execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  cwd: process.cwd(),
});

console.log("Running seed...");
execSync("npx tsx prisma/seed.ts", {
  stdio: "inherit",
  cwd: process.cwd(),
});

console.log("db:setup complete.");
