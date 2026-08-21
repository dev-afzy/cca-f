/**
 * Grade curriculum coverage against the 30 official CCA-F task statements.
 *
 *   npm run grade:coverage
 *
 * Method. Coverage is "taught AND tested", because that is what determines a
 * candidate's preparedness — whether an objective happens to own its own
 * internal concept row is an implementation detail.
 *
 *   1.0  taught explicitly in curriculum.md AND >=3 questions testing it
 *   0.5  taught explicitly but <3 questions, OR only incidental teaching
 *   0.0  absent
 *
 * `owners` and `explicit` are authored judgement (which concepts carry an
 * objective, and whether the curriculum names its mechanism directly rather
 * than in passing). Question counts are measured live from the DB, so the
 * grade moves on its own as content is added.
 *
 * Reported both unweighted (per objective) and weighted by the official domain
 * weights, since the exam samples items by domain weight, not per objective.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path"; import os from "node:os";

const p = new PrismaClient({ adapter: new PrismaLibSql({ url: `file:${path.join(os.homedir(), ".cca-f-tutor", "cca-f.db")}` }) });

// Questions required for full credit. 3 is the adequacy floor; raise it to
// stress-test whether coverage is deep or merely present: COVERAGE_MIN_QS=5.
const MIN_QS = Number(process.env.COVERAGE_MIN_QS ?? 3);

const DOMAIN_WEIGHT: Record<string, number> = { "1": 27, "2": 18, "3": 20, "4": 20, "5": 15 };
const DOMAIN_NAME: Record<string, string> = {
  "1": "Agentic Architecture & Orchestration",
  "2": "Tool Design & MCP Integration",
  "3": "Claude Code Configuration & Workflows",
  "4": "Prompt Engineering & Structured Output",
  "5": "Context Management & Reliability",
};

type Obj = { id: string; title: string; owners: string[]; explicit: boolean };

const OBJECTIVES: Obj[] = [
  { id: "1.1", title: "Design and implement agentic loops", owners: ["agentic-loop-termination"], explicit: true },
  { id: "1.2", title: "Orchestrate multi-agent coordinator-subagent patterns", owners: ["agent-pattern-orch", "multi-agent-orchestration"], explicit: true },
  { id: "1.3", title: "Configure subagent invocation, context passing, spawning", owners: ["multi-agent-orchestration"], explicit: true },
  { id: "1.4", title: "Multi-step workflows with enforcement and handoff patterns", owners: ["guardrails", "agent-pattern-orch"], explicit: true },
  { id: "1.5", title: "Agent SDK hooks for interception and data normalization", owners: ["agent-sdk-hooks"], explicit: true },
  { id: "1.6", title: "Task decomposition strategies for complex workflows", owners: ["task-decomposition"], explicit: true },
  { id: "1.7", title: "Manage session state, resumption, and forking", owners: ["session-management"], explicit: true },

  { id: "2.1", title: "Design tool interfaces with clear descriptions/boundaries", owners: ["tool-interface-errors"], explicit: true },
  { id: "2.2", title: "Implement structured error responses for MCP tools", owners: ["tool-interface-errors"], explicit: true },
  { id: "2.3", title: "Distribute tools across agents; configure tool choice", owners: ["tool-calling-patterns"], explicit: true },
  { id: "2.4", title: "Integrate MCP servers into Claude Code and agent workflows", owners: ["mcp-architecture", "mcp-primitives"], explicit: true },
  { id: "2.5", title: "Select and apply built-in tools (Read/Write/Edit/Bash/Grep/Glob)", owners: ["builtin-tool-selection"], explicit: true },

  { id: "3.1", title: "Configure CLAUDE.md hierarchy, scoping, modular organization", owners: ["claude-md-rules"], explicit: true },
  { id: "3.2", title: "Create and configure custom slash commands and skills", owners: ["skills-commands-planmode", "skill-vs-tool"], explicit: true },
  { id: "3.3", title: "Apply path-specific rules for conditional convention loading", owners: ["claude-md-rules"], explicit: true },
  { id: "3.4", title: "Determine when to use plan mode vs direct execution", owners: ["skills-commands-planmode"], explicit: true },
  { id: "3.5", title: "Apply iterative refinement techniques", owners: ["cicd-refinement"], explicit: true },
  { id: "3.6", title: "Integrate Claude Code into CI/CD pipelines", owners: ["cicd-refinement"], explicit: true },

  { id: "4.1", title: "Design prompts with explicit criteria", owners: ["prompt-engineering"], explicit: true },
  { id: "4.2", title: "Apply few-shot prompting", owners: ["prompt-engineering"], explicit: true },
  { id: "4.3", title: "Enforce structured output via tool use and JSON schemas", owners: ["structured-outputs"], explicit: true },
  { id: "4.4", title: "Validation, retry, and feedback loops for extraction quality", owners: ["structured-outputs", "batch-extraction-quality"], explicit: true },
  { id: "4.5", title: "Design efficient batch processing strategies", owners: ["batch-extraction-quality"], explicit: true },
  { id: "4.6", title: "Multi-instance and multi-pass review architectures", owners: ["multi-instance-review"], explicit: true },

  { id: "5.1", title: "Manage conversation context across long interactions", owners: ["context-window-mgmt"], explicit: true },
  { id: "5.2", title: "Escalation and ambiguity resolution patterns", owners: ["guardrails"], explicit: true },
  { id: "5.3", title: "Error propagation across multi-agent systems", owners: ["error-propagation-provenance"], explicit: true },
  { id: "5.4", title: "Manage context in large codebase exploration", owners: ["codebase-exploration-context"], explicit: true },
  { id: "5.5", title: "Human review workflows and confidence calibration", owners: ["human-review-calibration"], explicit: true },
  { id: "5.6", title: "Preserve provenance and handle uncertainty in synthesis", owners: ["error-propagation-provenance"], explicit: true },
];

(async () => {
  const counts = new Map<string, number>();
  for (const c of await p.concept.findMany({ select: { id: true, slug: true } })) {
    counts.set(c.slug, await p.question.count({ where: { conceptId: c.id } }));
  }

  const perDomain: Record<string, { got: number; max: number }> = {};
  const thin: string[] = [];
  console.log(`Full credit requires >=${MIN_QS} questions (COVERAGE_MIN_QS)\n`);
  console.log("OBJ   QS  SCORE  OBJECTIVE");
  console.log("─".repeat(78));
  for (const o of OBJECTIVES) {
    const d = o.id.split(".")[0];
    const qs = o.owners.reduce((s, slug) => s + (counts.get(slug) ?? 0), 0);
    const score = o.explicit ? (qs >= MIN_QS ? 1 : qs >= 1 ? 0.5 : 0) : (qs >= MIN_QS ? 0.5 : 0);
    (perDomain[d] ??= { got: 0, max: 0 });
    perDomain[d].got += score; perDomain[d].max += 1;
    if (score < 1) thin.push(`${o.id} (${score}) ${o.title} — owners: ${o.owners.join(", ")} · ${qs} questions`);
    console.log(`${o.id.padEnd(5)} ${String(qs).padStart(3)}  ${score.toFixed(1).padStart(5)}  ${o.title.slice(0, 56)}`);
  }

  let weighted = 0, unweightedGot = 0, unweightedMax = 0;
  console.log("\nDOMAIN                                    WT   SCORE     PCT");
  console.log("─".repeat(78));
  for (const d of Object.keys(DOMAIN_WEIGHT)) {
    const { got, max } = perDomain[d];
    const pct = (got / max) * 100;
    weighted += pct * (DOMAIN_WEIGHT[d] / 100);
    unweightedGot += got; unweightedMax += max;
    console.log(`${d} ${DOMAIN_NAME[d].padEnd(38)} ${String(DOMAIN_WEIGHT[d]).padStart(2)}%  ${got.toFixed(1)}/${max}  ${pct.toFixed(1).padStart(6)}%`);
  }
  console.log("─".repeat(78));
  console.log(`UNWEIGHTED  ${unweightedGot.toFixed(1)}/${unweightedMax} = ${((unweightedGot / unweightedMax) * 100).toFixed(1)}%`);
  console.log(`WEIGHTED (by official domain weights) = ${weighted.toFixed(1)}%`);
  if (thin.length) { console.log(`\nBELOW FULL CREDIT (${thin.length}):`); thin.forEach(t => console.log("  " + t)); }
  await p.$disconnect();
})();
