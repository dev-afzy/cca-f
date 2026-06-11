import "server-only";
import os from "node:os";
import path from "node:path";

export function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") return path.join(os.homedir(), p.slice(1));
  return p;
}

export const DATA_DIR = path.join(os.homedir(), ".cca-f-tutor");
export const DB_PATH = path.join(DATA_DIR, "cca-f.db");
export const LEDGER_PATH = path.join(DATA_DIR, "student-ledger.md");
