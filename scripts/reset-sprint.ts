/**
 * Reset the default student's sprint clock to start today.
 *
 *   sprintStartDate = today (midnight UTC)
 *   targetExamDate  = today + 23 days
 *
 * Use whenever the calendar pace drifts away from actual study cadence — e.g.
 * you took a multi-day break and the tutor is now nagging you about being
 * behind by N hours. Keeps every other column (currentHour, masteries,
 * sessions, attempts) intact.
 *
 *   npm run db:reset-sprint
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";
import os from "node:os";

const dbPath = path.join(os.homedir(), ".cca-f-tutor", "cca-f.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const SPRINT_DAYS = 23;

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
    where: { id: "default" },
    select: { sprintStartDate: true, targetExamDate: true, currentHour: true },
  });
  if (!before) {
    console.error('No student with id="default" found. Run `npm run db:setup` first.');
    process.exit(1);
  }

  await prisma.student.update({
    where: { id: "default" },
    data: { sprintStartDate: startOfTodayUtc, targetExamDate },
  });

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  console.log(`Sprint reset for student "default" (currentHour=${before.currentHour}, kept as-is):`);
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
