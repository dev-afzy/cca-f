import "server-only";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "./prisma";
import { expandHome } from "./paths";
import { renderLedger } from "./ledger-render";

// The markdown ledger is an export-only convenience artifact — the /ledger page
// and /api/ledger render from the database, nothing reads this file. On a
// read-only/ephemeral serverless filesystem (Vercel) the write must not run.
// Write locally by default; skip on Vercel. CCAF_LEDGER_FILE forces on/off.
function ledgerFileEnabled(): boolean {
  const flag = process.env.CCAF_LEDGER_FILE;
  if (flag === "on") return true;
  if (flag === "off") return false;
  return !process.env.VERCEL;
}

export async function syncLedger(
  studentId: string
): Promise<{ path: string; bytes: number; written: boolean }> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { ledgerPath: true },
  });

  if (!student) throw new Error(`Student ${studentId} not found`);

  const md = await renderLedger(studentId);
  const expandedPath = expandHome(student.ledgerPath);
  const bytes = Buffer.byteLength(md, "utf8");

  if (!ledgerFileEnabled()) {
    return { path: expandedPath, bytes, written: false };
  }

  try {
    fs.mkdirSync(path.dirname(expandedPath), { recursive: true });
    const tmpPath = expandedPath + ".tmp";
    fs.writeFileSync(tmpPath, md, "utf8");
    fs.renameSync(tmpPath, expandedPath);
    return { path: expandedPath, bytes, written: true };
  } catch (err) {
    // A read-only/ephemeral FS must never break the request (the DB is the
    // source of truth); report the artifact as not written.
    console.error("[ledger-sync] file write skipped:", err);
    return { path: expandedPath, bytes, written: false };
  }
}
