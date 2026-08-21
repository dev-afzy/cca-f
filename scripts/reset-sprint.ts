/**
 * Reset a student's sprint clock to start today.
 *
 *   sprintStartDate = today (midnight UTC)
 *   targetExamDate  = today + 23 days
 *
 * Usage:
 *   npm run db:reset-sprint [studentId]
 *
 * studentId defaults to "default" when omitted. Pass a real user id (e.g. the
 * OAuth sub) to reset any individual student's sprint without touching others.
 *
 * Use whenever the calendar pace drifts away from actual study cadence — e.g.
 * you took a multi-day break and the tutor is now nagging you about being
 * behind by N hours. Keeps every other column (currentHour, masteries,
 * sessions, attempts) intact.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";
import os from "node:os";

const dbPath = path.join(os.homedir(), ".cca-f-tutor", "cca-f.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const SPRINT_DAYS = 23;
const studentId = process.argv[2] ?? "default";

async function main() {
  // Pin to midnight UTC so day math is stable across timezones.
  const now = new Date();
  const startOfTodayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const targetExamDate = new Date(
    startOfTodayUtc.getTime() + SPRINT_DAYS * 86400000
  );

  const before = await prisma.student.findUnique({
    where: { id: studentId },
    select: { sprintStartDate: true, targetExamDate: true, currentHour: true },
  });
  if (!before) {
    console.error(`No student with id="${studentId}" found. Run \`npm run db:setup\` first.`);
    process.exit(1);
  }

  await prisma.student.update({
    where: { id: studentId },
    data: { sprintStartDate: startOfTodayUtc, targetExamDate },
  });

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  console.log(`Sprint reset for student "${studentId}" (currentHour=${before.currentHour}, kept as-is):`);
  console.log(`  sprintStartDate: ${iso(before.sprintStartDate)} → ${iso(startOfTodayUtc)}`);
  console.log(`  targetExamDate:  ${iso(before.targetExamDate)} → ${iso(targetExamDate)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
