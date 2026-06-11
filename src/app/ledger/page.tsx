import { prisma } from "@/lib/prisma";
import { HOUR_TOPICS } from "@/lib/hour-topics";
import { SyncButton } from "./SyncButton";
import ThemeToggle from "../ThemeToggle";

function masteryColor(mastery: number): string {
  if (mastery >= 80) return "bg-emerald-500";
  if (mastery >= 60) return "bg-sky-500";
  if (mastery >= 40) return "bg-amber-400";
  return "bg-red-400";
}

function masteryLabel(mastery: number): string {
  if (mastery >= 80) return "strong";
  if (mastery >= 60) return "working";
  if (mastery >= 40) return "weak";
  return "broken";
}

export default async function LedgerPage() {
  const now = new Date();

  const student = await prisma.student.findUnique({
    where: { id: "default" },
    include: {
      masteries: {
        include: { concept: true },
        orderBy: { concept: { sortOrder: "asc" } },
      },
      frictionPoints: {
        include: { concept: true },
        where: { resolved: false },
        orderBy: { createdAt: "asc" },
      },
      strongAreas: {
        include: { concept: true },
        orderBy: { promotedAt: "desc" },
      },
    },
  });

  if (!student) {
    return (
      <main className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-xl font-semibold text-stone-700 dark:text-stone-200">Database not initialized.</p>
          <p className="text-stone-500 dark:text-stone-400 font-mono text-sm">Run: npm run db:setup</p>
        </div>
      </main>
    );
  }

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
  const sprintStartStr = student.sprintStartDate.toISOString().slice(0, 10);
  const targetExamStr = student.targetExamDate.toISOString().slice(0, 10);
  const nextHour = Math.min(currentHour + 1, 23);
  const nextTopic = HOUR_TOPICS[nextHour] ?? "TBD";

  const week1Masteries = student.masteries.filter((m) => m.concept.week === 1);
  const week2Masteries = student.masteries.filter((m) => m.concept.week === 2);
  const week3Masteries = student.masteries.filter((m) => m.concept.week === 3);
  const week4Masteries = student.masteries.filter((m) => m.concept.week === 4);
  const crossMasteries = student.masteries.filter((m) => m.concept.week === 0);

  const masteryGroups = [
    { label: "Week 1 — API foundations & extraction quality", rows: week1Masteries },
    { label: "Week 2 — MCP, tools & agentic patterns", rows: week2Masteries },
    { label: "Week 3 — Claude Code & production workflows", rows: week3Masteries },
    { label: "Week 4 — Agentic deep-dive & exam sim", rows: week4Masteries },
    { label: "Cross-cutting", rows: crossMasteries },
  ];

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
      {/* Header */}
      <header className="border-b-2 border-stone-900 dark:border-stone-700 bg-stone-900 dark:bg-stone-800 text-stone-50">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-stone-400 mb-1">
              Claude Certified Architect — Foundations
            </p>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>
              Student Ledger
            </h1>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-right text-sm text-stone-400 font-mono">
              <div>{new Date().toISOString().slice(0, 10)}</div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        {/* Current Session */}
        <section>
          <h2 className="text-xs tracking-[0.2em] uppercase text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800 pb-1 mb-4">
            Current Session
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: "Hour", value: `${currentHour} / 23` },
              { label: "Week", value: String(week) },
              { label: "Sprint start", value: sprintStartStr },
              { label: "Target exam", value: targetExamStr },
              { label: "Days elapsed", value: String(daysElapsed) },
              { label: "Days remaining", value: String(daysRemaining) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded p-3">
                <div className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-1">{label}</div>
                <div className="font-mono text-stone-800 dark:text-stone-100 font-semibold">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded p-4">
            <p className="text-xs text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">Next up</p>
            <p className="text-stone-700 dark:text-stone-200">
              <span className="font-semibold">Hour {nextHour}</span> —{" "}
              {nextTopic}
            </p>
          </div>
        </section>

        {/* Concept Mastery */}
        <section>
          <h2 className="text-xs tracking-[0.2em] uppercase text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800 pb-1 mb-4">
            Concept Mastery
          </h2>

          <div className="space-y-6">
            {masteryGroups.map((group) => (
              <div key={group.label}>
                <h3 className="text-sm font-semibold text-stone-600 dark:text-stone-300 mb-3">{group.label}</h3>
                {group.rows.length === 0 ? (
                  <p className="text-sm text-stone-400 dark:text-stone-500 italic">None yet.</p>
                ) : (
                  <div className="space-y-2">
                    {group.rows.map((row) => (
                      <div key={row.id} className="flex items-center gap-3">
                        <span className="text-sm text-stone-700 dark:text-stone-200 w-72 shrink-0">
                          {row.concept.name}
                        </span>
                        <div className="flex-1 bg-gray-200 dark:bg-stone-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${masteryColor(row.mastery)}`}
                            style={{ width: `${row.mastery}%` }}
                          />
                        </div>
                        <span
                          className={`text-xs font-mono w-12 text-right ${
                            row.mastery >= 80
                              ? "text-emerald-700 dark:text-emerald-400"
                              : row.mastery >= 60
                              ? "text-sky-700 dark:text-sky-400"
                              : row.mastery >= 40
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {row.mastery}%
                        </span>
                        <span className="text-xs text-stone-400 dark:text-stone-500 w-16 text-right">
                          {masteryLabel(row.mastery)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-stone-400 dark:text-stone-500 font-mono">
            Legend: 0–39 broken | 40–59 weak | 60–79 working | 80–100 strong
          </p>
        </section>

        {/* Weak Areas */}
        <section>
          <h2 className="text-xs tracking-[0.2em] uppercase text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800 pb-1 mb-4">
            Weak Areas / Friction Points
          </h2>
          {student.frictionPoints.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-stone-500 italic">None yet.</p>
          ) : (
            <ul className="space-y-2">
              {student.frictionPoints.map((fp) => (
                <li key={fp.id} className="text-sm text-stone-700 dark:text-stone-200 flex gap-2">
                  <span className="text-stone-400 dark:text-stone-500 shrink-0 font-mono text-xs pt-0.5">
                    H{fp.hour}
                  </span>
                  <span>
                    <span className="font-medium text-stone-600 dark:text-stone-300">
                      {fp.concept?.name ?? "General"}
                    </span>{" "}
                    — {fp.description}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Strong Areas */}
        <section>
          <h2 className="text-xs tracking-[0.2em] uppercase text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800 pb-1 mb-4">
            Strong Areas
          </h2>
          {student.strongAreas.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-stone-500 italic">None yet.</p>
          ) : (
            <ul className="space-y-1">
              {student.strongAreas.map((sa) => (
                <li key={sa.id} className="text-sm text-stone-700 dark:text-stone-200 flex gap-2 items-center">
                  <span className="text-emerald-500">&#10003;</span>
                  <span>{sa.concept.name}</span>
                  <span className="text-stone-400 dark:text-stone-500 font-mono text-xs">
                    {sa.promotedAt.toISOString().slice(0, 10)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Sync */}
        <section>
          <h2 className="text-xs tracking-[0.2em] uppercase text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800 pb-1 mb-4">
            Sync to Disk
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-3">
            Write the student ledger markdown to{" "}
            <code className="font-mono text-xs bg-stone-100 dark:bg-stone-800 dark:text-stone-200 px-1 py-0.5 rounded">
              {student.ledgerPath}
            </code>{" "}
            so the Claude Code skill can read it.
          </p>
          <SyncButton />
        </section>
      </div>
    </main>
  );
}
