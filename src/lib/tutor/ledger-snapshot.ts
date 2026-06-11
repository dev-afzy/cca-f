import "server-only";
import { prisma } from "@/lib/prisma";
import type { LedgerSnapshot } from "@/lib/types";

export async function buildLedgerSnapshot(
  studentId: string
): Promise<LedgerSnapshot> {
  const now = new Date();

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      currentHour: true,
      preferredStyle: true,
      sprintStartDate: true,
      targetExamDate: true,
      masteries: {
        include: { concept: true },
        orderBy: { concept: { sortOrder: "asc" } },
      },
      frictionPoints: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { concept: true },
      },
      sessions: {
        orderBy: { startedAt: "desc" },
        take: 5,
      },
    },
  });

  if (!student) throw new Error(`Student ${studentId} not found`);

  const daysElapsed = Math.max(
    0,
    Math.floor((now.getTime() - student.sprintStartDate.getTime()) / 86400000)
  );
  const daysRemaining = Math.max(
    0,
    Math.floor((student.targetExamDate.getTime() - now.getTime()) / 86400000)
  );

  let preferredStyle: string[] = [];
  try {
    preferredStyle = JSON.parse(student.preferredStyle) as string[];
  } catch {
    // ignore
  }

  // Build mastery table (markdown)
  const weekGroups = [
    { label: "Week 1", weekNum: 1 },
    { label: "Week 2", weekNum: 2 },
    { label: "Week 3", weekNum: 3 },
    { label: "Week 4", weekNum: 4 },
    { label: "Cross-cutting", weekNum: 0 },
  ];
  let masteryTable = "| Concept | Mastery |\n|---|---|\n";
  for (const group of weekGroups) {
    const rows = student.masteries
      .filter((m) => m.concept.week === group.weekNum)
      .sort((a, b) => a.concept.sortOrder - b.concept.sortOrder);
    if (rows.length > 0) {
      masteryTable += `| **${group.label}** | |\n`;
      for (const row of rows) {
        masteryTable += `| ${row.concept.name} | ${row.mastery}% |\n`;
      }
    }
  }

  // Recent friction (last 10, reverse-chron)
  const recentFrictionList =
    student.frictionPoints.length === 0
      ? "_None yet._"
      : student.frictionPoints
          .map((fp) => {
            const dateStr = fp.createdAt.toISOString().slice(0, 10);
            const conceptName = fp.concept?.name ?? "General";
            const resolvedTag = fp.resolved ? " [RESOLVED]" : "";
            return `- ${dateStr}, Hour ${fp.hour} — ${conceptName} — ${fp.description}${resolvedTag}`;
          })
          .join("\n");

  // Recent sessions (last 5, reverse-chron)
  const recentSessionList =
    student.sessions.length === 0
      ? "_None yet._"
      : student.sessions
          .map((s) => {
            const dateStr = s.startedAt.toISOString().slice(0, 10);
            return `| ${dateStr} | ${s.hour} | ${s.topic} | ${s.outcome || "—"} |`;
          })
          .join("\n");

  return {
    daysElapsed,
    daysRemaining,
    preferredStyle,
    masteryTable,
    recentFrictionList,
    recentSessionList,
    currentHour: student.currentHour,
  };
}
