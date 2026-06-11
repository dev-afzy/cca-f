/**
 * Read-only audit: for each session, summarise what concepts were actually
 * exercised (via QuestionAttempt + FrictionPoint), and compare to the
 * recorded `hour` field. Flags drift between "what the DB thinks this session
 * was" vs "what was actually taught."
 *
 *   npm run db:audit-sessions
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";
import os from "node:os";
import { HOUR_TOPICS } from "../src/lib/hour-topics";

const dbPath = path.join(os.homedir(), ".cca-f-tutor", "cca-f.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

// Concept slug → primary curriculum hour. Cross-cutting concepts (week=0) and
// concepts that span multiple hours are left out and don't vote in the
// inferred-hour majority.
const SLUG_TO_HOUR: Record<string, number> = {
  "model-selection": 1,
  "context-window-mgmt": 2,
  "batch-extraction-quality": 3,
  "structured-outputs": 4,
  "tool-calling-mechanics": 5,
  "tool-calling-patterns": 6,
  // Week 1 consolidation = hour 7 (no dedicated concept)
  "mcp-architecture": 8,
  "mcp-primitives": 9,
  "tool-interface-errors": 10,
  "skill-vs-tool": 9,
  "error-propagation-provenance": 11,
  "agent-pattern-orch": 12,
  "agent-pattern-eval": 13,
  "agentic-loop-termination": 5,
  "claude-md-rules": 15,
  "skills-commands-planmode": 16,
  "guardrails": 17,
  "cicd-refinement": 18,
  "prompt-engineering": 19,
  "multi-agent-orchestration": 20,
  "session-management": 21,
  "multi-instance-review": 13,
};

type ConceptStats = {
  slug: string;
  name: string;
  attempts: number;
  correct: number;
  friction: number;
};

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

async function main() {
  const sessions = await prisma.session.findMany({
    orderBy: { startedAt: "asc" },
    include: {
      attempts: { include: { question: { include: { concept: true } } } },
      frictionPoints: { include: { concept: true } },
    },
  });

  const lines: string[] = [];
  lines.push("");
  lines.push(`Session audit  —  ${sessions.length} sessions on record`);
  lines.push("=".repeat(78));

  let driftCount = 0;

  for (const s of sessions) {
    const stats = new Map<string, ConceptStats>();

    for (const a of s.attempts) {
      const c = a.question.concept;
      if (!c) continue;
      const e = stats.get(c.slug) ?? {
        slug: c.slug,
        name: c.name,
        attempts: 0,
        correct: 0,
        friction: 0,
      };
      e.attempts += 1;
      if (a.correct) e.correct += 1;
      stats.set(c.slug, e);
    }
    for (const fp of s.frictionPoints) {
      if (!fp.concept) continue;
      const e = stats.get(fp.concept.slug) ?? {
        slug: fp.concept.slug,
        name: fp.concept.name,
        attempts: 0,
        correct: 0,
        friction: 0,
      };
      e.friction += 1;
      stats.set(fp.concept.slug, e);
    }

    // Inferred hour = the curriculum hour touched most heavily by attempts
    // (friction breaks ties only when there are no attempts). Cross-cutting
    // concepts don't vote.
    const hourVotes = new Map<number, number>();
    for (const entry of stats.values()) {
      const hour = SLUG_TO_HOUR[entry.slug];
      if (hour === undefined) continue;
      const weight = entry.attempts > 0 ? entry.attempts : entry.friction * 0.5;
      hourVotes.set(hour, (hourVotes.get(hour) ?? 0) + weight);
    }
    let inferredHour: number | null = null;
    let bestVotes = -1;
    for (const [hour, votes] of hourVotes) {
      if (votes > bestVotes) {
        bestVotes = votes;
        inferredHour = hour;
      }
    }

    const drift =
      inferredHour !== null && inferredHour !== s.hour ? "  ⚠ DRIFT" : "";
    if (drift) driftCount += 1;

    lines.push("");
    lines.push(
      `Session ${s.id}  —  recorded as Hour ${s.hour} (${s.topic})${drift}`
    );
    lines.push(
      `  ${fmtDate(s.startedAt)}  →  ${s.endedAt ? fmtDate(s.endedAt) : "(open)"}`
    );

    if (stats.size === 0) {
      lines.push("  (no attempts, no friction)");
    } else {
      const rows = Array.from(stats.values()).sort(
        (a, b) =>
          b.attempts - a.attempts ||
          b.friction - a.friction ||
          a.slug.localeCompare(b.slug)
      );
      for (const r of rows) {
        const attemptsStr =
          r.attempts > 0
            ? `${r.attempts} attempt${r.attempts === 1 ? "" : "s"} (${r.correct} ✓ ${r.attempts - r.correct} ✗)`
            : "—";
        const frictionStr = r.friction > 0 ? `, friction ×${r.friction}` : "";
        const hour = SLUG_TO_HOUR[r.slug];
        const hourTag = hour !== undefined ? `[H${hour}]` : "[cross]";
        lines.push(
          `    ${pad(hourTag, 7)} ${pad(r.slug, 30)} ${attemptsStr}${frictionStr}`
        );
      }
      if (inferredHour !== null) {
        const verdict =
          inferredHour === s.hour
            ? "matches recorded"
            : `recorded Hour ${s.hour}, but content was Hour ${inferredHour} (${HOUR_TOPICS[inferredHour] ?? "?"})`;
        lines.push(`  inferred primary hour: ${inferredHour}  —  ${verdict}`);
      }
    }
  }

  lines.push("");
  lines.push("=".repeat(78));
  lines.push(
    `Summary: ${driftCount} of ${sessions.length} sessions show drift between recorded hour and content.`
  );
  lines.push("");

  console.log(lines.join("\n"));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
