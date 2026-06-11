import "server-only";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "./prisma";
import { expandHome } from "./paths";
import { renderLedger } from "./ledger-render";

export async function syncLedger(
  studentId: string
): Promise<{ path: string; bytes: number }> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { ledgerPath: true },
  });

  if (!student) throw new Error(`Student ${studentId} not found`);

  const md = await renderLedger(studentId);
  const expandedPath = expandHome(student.ledgerPath);

  fs.mkdirSync(path.dirname(expandedPath), { recursive: true });

  const tmpPath = expandedPath + ".tmp";
  fs.writeFileSync(tmpPath, md, "utf8");
  fs.renameSync(tmpPath, expandedPath);

  const bytes = Buffer.byteLength(md, "utf8");
  return { path: expandedPath, bytes };
}
