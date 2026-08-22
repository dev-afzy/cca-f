// Pure date math — no "server-only", no prisma. Safe to import from plain
// tsx scripts (e.g. scripts/reset-sprint.ts) as well as server code.
export const SPRINT_DAYS = 24;

/** Midnight UTC today — pinned so day math is stable across timezones. */
export function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function freshSprintDates(): { sprintStartDate: Date; targetExamDate: Date } {
  const sprintStartDate = startOfTodayUtc();
  const targetExamDate = new Date(sprintStartDate.getTime() + SPRINT_DAYS * 86400000);
  return { sprintStartDate, targetExamDate };
}
