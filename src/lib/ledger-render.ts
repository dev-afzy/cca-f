import "server-only";
import { prisma } from "./prisma";
import { HOUR_TOPICS } from "./hour-topics";

export async function renderLedger(studentId: string, now = new Date()): Promise<string> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      masteries: {
        include: { concept: true },
        orderBy: { concept: { sortOrder: "asc" } },
      },
      frictionPoints: {
        include: { concept: true },
        orderBy: { createdAt: "asc" },
      },
      strongAreas: {
        include: { concept: true },
        orderBy: { promotedAt: "asc" },
      },
      misconceptions: {
        orderBy: { openedAt: "asc" },
      },
      sessions: {
        orderBy: { startedAt: "asc" },
      },
      sprintNotes: {
        orderBy: { createdAt: "asc" },
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

  const currentHour = student.currentHour;
  const week =
    currentHour <= 7 ? 1 : currentHour <= 14 ? 2 : currentHour <= 19 ? 3 : 4;

  const lastUpdated = now.toISOString().slice(0, 10);
  const sprintStartStr = student.sprintStartDate.toISOString().slice(0, 10);
  const targetExamStr = student.targetExamDate.toISOString().slice(0, 10);

  // Build preferred style display
  let preferredStyleDisplay = "_None yet._";
  try {
    const styles = JSON.parse(student.preferredStyle) as string[];
    if (styles.length > 0) {
      preferredStyleDisplay = styles.map((s) => `- ${s}`).join("\n");
    }
  } catch {
    // ignore parse errors
  }

  // [Next Up] block
  const nextHour = Math.min(currentHour + 1, 23);
  const nextTopic = HOUR_TOPICS[nextHour] ?? "TBD";
  const unresolvedFriction = student.frictionPoints.find((fp) => !fp.resolved);
  const warmUp = unresolvedFriction
    ? unresolvedFriction.description
    : "fresh material";
  const nextUpLine = `> Hour ${nextHour} — ${nextTopic}. Start with ${warmUp} as warm-up.`;

  // Concept mastery grouped by week
  const weekGroups: Array<{ label: string; weekNum: number }> = [
    { label: "Week 1 — API foundations & extraction quality", weekNum: 1 },
    { label: "Week 2 — MCP, tools & agentic patterns", weekNum: 2 },
    { label: "Week 3 — Claude Code & production workflows", weekNum: 3 },
    { label: "Week 4 — Agentic deep-dive & exam sim", weekNum: 4 },
    { label: "Cross-cutting", weekNum: 0 },
  ];

  let masterySection = "";
  for (const group of weekGroups) {
    const rows = student.masteries
      .filter((m) => m.concept.week === group.weekNum)
      .sort((a, b) => a.concept.sortOrder - b.concept.sortOrder);

    masterySection += `### ${group.label}\n`;
    if (rows.length === 0) {
      masterySection += "_None yet._\n";
    } else {
      for (const row of rows) {
        masterySection += `- ${row.concept.name}: ${row.mastery}%\n`;
      }
    }
    masterySection += "\n";
  }
  masterySection += "Legend: 0–39 broken | 40–59 weak | 60–79 working | 80–100 strong.";

  // Weak areas / friction points
  const frictionLines =
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

  // Strong areas
  const strongLines =
    student.strongAreas.length === 0
      ? "_None yet._"
      : student.strongAreas
          .map((sa) => {
            const dateStr = sa.promotedAt.toISOString().slice(0, 10);
            return `- ${sa.concept.name} — ${dateStr}`;
          })
          .join("\n");

  // Misconceptions
  const miscLines =
    student.misconceptions.length === 0
      ? "_None yet._"
      : student.misconceptions
          .map((m) => {
            const dateStr = m.openedAt.toISOString().slice(0, 10);
            const resolvedStr = m.resolvedAt
              ? m.resolvedAt.toISOString().slice(0, 10)
              : "open";
            return `- ${dateStr} — ${m.belief} — ${resolvedStr}`;
          })
          .join("\n");

  // Session history table
  const sessionRows =
    student.sessions.length === 0
      ? "| — | — | — | — |"
      : student.sessions
          .map((s) => {
            const dateStr = s.startedAt.toISOString().slice(0, 10);
            return `| ${dateStr} | ${s.hour} | ${s.topic} | ${s.outcome || "—"} |`;
          })
          .join("\n");

  // Sprint notes
  const sprintNotesBody =
    student.sprintNotes.length === 0
      ? "_None yet._"
      : student.sprintNotes.map((n) => n.body).join("\n\n");

  // Student profile
  const nameDisplay = student.name || "_Not set._";
  const preferredAddressDisplay = student.preferredAddress || "_Not set._";
  const backgroundDisplay = student.background || "_Not set._";
  const timezoneDisplay = student.timezone || "_Not set._";

  const md = `# CCA-F Tutor — Student Ledger

> Last updated: ${lastUpdated}

## [Current Session]

- Hour: ${currentHour} / 23
- Week: ${week}
- Sprint start date: ${sprintStartStr}
- Target exam date: ${targetExamStr}
- Days elapsed: ${daysElapsed}
- Days remaining in sprint: ${daysRemaining}
- Ledger file path: ${student.ledgerPath}

## [Student Profile]

- Name / preferred address: ${nameDisplay} / ${preferredAddressDisplay}
- Background: ${backgroundDisplay}
- Prerequisites completed: ${student.prerequisites}
- Time zone / typical study time: ${timezoneDisplay}

## [Preferred Teaching Style]

${preferredStyleDisplay}

## [Concept Mastery]

Track each concept area as a percentage. Update after every session that touched the area.

${masterySection}

## [Weak Areas / Friction Points]

${frictionLines}

## [Strong Areas]

${strongLines}

## [Misconceptions Log]

${miscLines}

## [Session History]

| Date | Hour | Topic | Outcome |
|---|---|---|---|
${sessionRows}

## [Next Up]

The exact topic for the next session. Be specific.

${nextUpLine}

## [Sprint Notes]

${sprintNotesBody}
`;

  return md;
}
