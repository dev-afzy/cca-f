/**
 * Reset a student's sprint clock to start today. Recalibrates the calendar
 * only — currentHour, mastery, sessions and attempts are kept as-is.
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
 * behind by N hours.
 *
 * To start an entirely new sprint attempt (Hour 0, mastery reset to 0%), use
 * the in-app "Start new sprint" action on the landing page instead — that
 * calls restartSprint() in src/lib/sprint.ts, which this script deliberately
 * does not.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";
import os from "node:os";
import { freshSprintDates } from "../src/lib/sprint-dates";

const dbPath = path.join(os.homedir(), ".cca-f-tutor", "cca-f.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const studentId = process.argv[2] ?? "default";

async function main() {
  const { sprintStartDate, targetExamDate } = freshSprintDates();

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
    data: { sprintStartDate, targetExamDate },
  });

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  console.log(`Sprint reset for student "${studentId}" (currentHour=${before.currentHour}, kept as-is):`);
  console.log(`  sprintStartDate: ${iso(before.sprintStartDate)} → ${iso(sprintStartDate)}`);
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
