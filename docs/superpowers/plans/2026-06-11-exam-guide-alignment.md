# CCA-F Exam-Guide Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Realign the CCA-F tutor's curriculum, question bank, ledger template, and app seed data with the official *Claude Certified Architect – Foundations Exam Guide* (v0.1) — closing the Domain 3 (Claude Code Configuration, 20%) blind spot, removing ~5 hours of explicitly out-of-scope material, fixing the "programmatic always wins" distractor miscalibration, and recording correct exam mechanics.

**Architecture:** Content lives in two coupled layers that must stay in sync: markdown skill files (`.claude/skills/*.md`, read at runtime by `src/lib/skill-files.ts`) and TypeScript seed data (`src/lib/concept-seed.ts`, `src/lib/question-seed.ts`, `src/lib/hour-topics.ts`) which `prisma/seed.ts` upserts into a SQLite DB at `~/.cca-f-tutor/cca-f.db`. A new `scripts/validate-content.ts` enforces cross-layer consistency and is run after every task. Concepts are retired via a new deletion pass in `prisma/seed.ts` (upsert alone leaves stale rows).

**Tech Stack:** Next.js 16 / TypeScript, Prisma 7 + libsql (SQLite), tsx for scripts. No test framework exists; the validator script is the regression net, plus `npm run build` for type-checking.

**Background docs the engineer should skim first:**
- `.claude/skills/curriculum.md` — current 23-hour plan (format: Objectives / Topics / Friction zones / Analogy seed per hour)
- `.claude/skills/question-bank.md` — distractor patterns + exemplars + mock specs
- `src/lib/skill-files.ts:31-58` — `getCurriculumHour()` extracts sections by `### Hour N` headings; **every hour heading must keep the exact format `### Hour N — Title`**
- `prisma/seed.ts` — upserts concepts by `slug`, questions by `slug`; masteries cascade-delete with concepts; question attempts cascade-delete with questions

---

## Design Decisions (locked in)

**Hour-by-hour target state** (★ = new/retitled hour; titles must match `HOUR_TOPICS` exactly):

| Hour | Title | Exam-guide tasks covered |
|---|---|---|
| 1 ★ | Diagnostic + Exam Map & Distractor Literacy | mechanics, distractor patterns |
| 2 | Context Window Management | 5.1 (adds lost-in-the-middle, case-facts, trimming) |
| 3 ★ | Batch Processing & Extraction Quality | 4.4, 4.5, 5.5 |
| 4 | Structured Outputs (JSON Mode) | 4.3 (adds nullable, enum+"other") |
| 5 | Tool Calling Mechanics | 1.1 |
| 6 | Tool Calling Patterns | 2.3 (adds tool-count degradation, scoped distribution) |
| 7 | Week 1 Consolidation + Mini-Mock | — |
| 8 ★ | MCP Integration & Configuration | 2.4, 2.5 (transport/JSON-RPC depth cut) |
| 9 | MCP Servers: Tools, Resources, Prompts | 2.4 resources |
| 10 ★ | Tool Interface Design & Structured Errors | 2.1, 2.2 (OAuth/auth depth cut) |
| 11 ★ | Error Propagation & Provenance in Multi-Agent Systems | 5.3, 5.6 (replaces Router) |
| 12 | Agent Pattern: Orchestrator-Workers | 1.2, 1.4 (adds refinement loop, handoff, absorbs Router) |
| 13 | Agent Pattern: Evaluator-Optimizer | 4.6 |
| 14 | Week 2 Consolidation + Mini-Mock | — |
| 15 ★ | CLAUDE.md Hierarchy & Path-Scoped Rules | 3.1, 3.3 (replaces PII) |
| 16 ★ | Slash Commands, Skills & Plan Mode | 3.2, 3.4, 5.4 (replaces Prompt Injection) |
| 17 | Guardrails: Multi-Layer Defense | 1.4, 1.5, 5.2 (adds escalation criteria + proportionality) |
| 18 ★ | Claude Code in CI/CD & Iterative Refinement | 3.5, 3.6 (replaces Prompt Caching) |
| 19 ★ | Prompt Engineering: Explicit Criteria & Few-Shot | 4.1, 4.2 (caching teaser cut) |
| 20 | Multi-Agent Orchestration (Hub & Spoke) | 1.3 (adds AgentDefinition) |
| 21 | Session Management & Workflows | 1.6, 1.7 (adds resume-vs-fresh-summary) |
| 22 | Full Mock Exam #1 + Remediation | adds 720/1000 scoring note |
| 23 | Full Mock Exam #2 + Final Review + Exam Strategy | corrected mechanics |

**Concept retirements** (deleted from DB by new seed pass — masteries cascade, friction points keep text with null concept):
`token-mechanics-cost`, `stateful-tools-security`, `agent-pattern-router`, `data-privacy-pii`, `prompt-injection`, `prompt-caching`, `error-handling-resp`

**New concepts:** `batch-extraction-quality` (w1, Prompts), `tool-interface-errors` (w2, Tool & MCP), `error-propagation-provenance` (w2, Context), `claude-md-rules` (w3, Claude Code), `skills-commands-planmode` (w3, Claude Code), `cicd-refinement` (w3, Claude Code)

**Re-tags/renames (slug kept):** `guardrails` domain Claude Code → **Agentic** (hooks are exam Domain 1; its 4 questions re-tag too), `multi-instance-review` domain Agentic → **Prompts** (exam task 4.6), `mcp-architecture` renamed "MCP Integration & Configuration", `model-selection` renamed "Model Selection & Distractor Literacy", `prompt-engineering` renamed "Prompt Engineering: Explicit Criteria & Few-Shot", `guardrails` renamed "Guardrails (Hooks, Tool Gating, Escalation)".

**Question retirements:** `prompt-caching-breakpoint-placement` (topic explicitly out of scope). Its historical attempts cascade-delete — acceptable, noted.

**Mid-sprint warning:** retiring concepts deletes their mastery rows. If a student sprint is in progress, the ledger loses those percentages. This is intended (they track untested material), but flag it to the user before running Task 10's seed.

---

### Task 1: Content validator script

**Files:**
- Create: `scripts/validate-content.ts`
- Modify: `package.json` (add script)

- [ ] **Step 1: Write the validator**

Create `scripts/validate-content.ts`:

```typescript
import fs from "node:fs";
import path from "node:path";
import { CONCEPT_SEED } from "../src/lib/concept-seed";
import { QUESTION_SEED } from "../src/lib/question-seed";
import { HOUR_TOPICS } from "../src/lib/hour-topics";
import { DOMAIN_LABELS } from "../src/lib/domains";

const errors: string[] = [];
const root = process.cwd();
const curriculum = fs.readFileSync(
  path.join(root, ".claude", "skills", "curriculum.md"),
  "utf8"
);
const stateTemplate = fs.readFileSync(
  path.join(root, ".claude", "skills", "state-template.md"),
  "utf8"
);

// 1. Every question references an existing concept
const slugs = new Set(CONCEPT_SEED.map((c) => c.slug));
for (const q of QUESTION_SEED) {
  if (!slugs.has(q.conceptSlug)) {
    errors.push(`question "${q.slug}" references missing concept "${q.conceptSlug}"`);
  }
}

// 2. Question domain matches its concept's domain
const domainBySlug = new Map(CONCEPT_SEED.map((c) => [c.slug, c.domain]));
for (const q of QUESTION_SEED) {
  const cd = domainBySlug.get(q.conceptSlug);
  if (cd && cd !== q.domain) {
    errors.push(`question "${q.slug}" domain "${q.domain}" != concept domain "${cd}"`);
  }
}

// 3. Concept/question domains are known labels
for (const c of CONCEPT_SEED) {
  if (!(c.domain in DOMAIN_LABELS)) errors.push(`concept "${c.slug}" has unknown domain "${c.domain}"`);
}

// 4. HOUR_TOPICS matches curriculum "### Hour N — Title" headings for hours 1-23
for (let h = 1; h <= 23; h++) {
  const m = curriculum.match(new RegExp(`^### Hour ${h} — (.+)$`, "m"));
  if (!m) {
    errors.push(`curriculum.md missing heading "### Hour ${h} — ..."`);
  } else if (m[1].trim() !== HOUR_TOPICS[h]) {
    errors.push(`hour ${h}: curriculum title "${m[1].trim()}" != HOUR_TOPICS "${HOUR_TOPICS[h]}"`);
  }
}

// 5. Every concept name appears in state-template.md (ledger template stays in sync)
for (const c of CONCEPT_SEED) {
  if (!stateTemplate.includes(c.name)) {
    errors.push(`state-template.md missing concept name "${c.name}"`);
  }
}

// 6. Question shape: correctKey exists; distractorReasons covers every option
for (const q of QUESTION_SEED) {
  if (!(q.correctKey in q.options)) errors.push(`question "${q.slug}" correctKey not in options`);
  for (const k of Object.keys(q.options)) {
    if (!(k in q.distractorReasons)) errors.push(`question "${q.slug}" missing distractorReason for ${k}`);
  }
}

// 7. Unique slugs
const qSlugs = QUESTION_SEED.map((q) => q.slug);
if (new Set(qSlugs).size !== qSlugs.length) errors.push("duplicate question slugs");
if (slugs.size !== CONCEPT_SEED.length) errors.push("duplicate concept slugs");

if (errors.length) {
  console.error(`Content validation FAILED (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`Content validation passed: ${CONCEPT_SEED.length} concepts, ${QUESTION_SEED.length} questions, 23 hours.`);
```

- [ ] **Step 2: Add npm script**

In `package.json` `"scripts"`, after `"db:audit-sessions"` line, add:

```json
    "validate:content": "tsx scripts/validate-content.ts"
```

- [ ] **Step 3: Run validator — must PASS on the current (pre-change) state**

Run: `npm run validate:content`
Expected: `Content validation passed: 23 concepts, 17 questions, 23 hours.`
(If check 5 fails on current names, the current template/seed already drifted — fix nothing yet; note the failure and continue, it will be green after Task 6.)

- [ ] **Step 4: Commit**

```bash
git add scripts/validate-content.ts package.json
git commit -m "chore: add content consistency validator"
```

---

### Task 2: Curriculum Week 1 rewrite (Hours 1, 2, 3, 4, 6)

**Files:**
- Modify: `.claude/skills/curriculum.md` (intro line 3; Hour 1, 2, 3, 4, 6 sections)
- Modify: `src/lib/hour-topics.ts` (entries 1 and 3)

- [ ] **Step 1: Update the intro paragraph**

In `curriculum.md`, replace the sentence on line 3:

> Structure follows the attached blueprint: Week 1 patches API foundations, Week 2 goes deep on MCP and agents, Week 3 covers enterprise concerns, and Week 4 closes the Agentic Architecture deep-dive (multi-agent orchestration, session management) before running the mocks.

with:

> Structure follows the official CCA-F exam guide: Week 1 patches API foundations and extraction quality, Week 2 goes deep on MCP, tool design, and agent patterns, Week 3 covers Claude Code configuration and production workflows (Domain 3, 20% of the exam), and Week 4 closes the Agentic Architecture deep-dive (multi-agent orchestration, session management) before running the mocks. Domain weights: Agentic 27%, Claude Code 20%, Prompts 20%, Tool & MCP 18%, Context 15%.

- [ ] **Step 2: Replace the Hour 1 section**

Replace everything from `### Hour 1 — Diagnostic + Model Family Map` up to (not including) `### Hour 2` with:

```markdown
### Hour 1 — Diagnostic + Exam Map & Distractor Literacy

**Objectives:** Surface broken knowledge across the four prereq courses. Internalize the exam's structure and scoring. Learn the distractor patterns the exam reuses — including why "switch to a bigger model" is almost always a wrong answer.

**Topics:**
- Run the 3-question diagnostic battery from `pedagogy.md`.
- Exam map: 5 domains weighted 27% (Agentic) / 20% (Claude Code) / 20% (Prompts) / 18% (Tool & MCP) / 15% (Context). Questions are framed by 4 scenarios drawn at random from 6 published ones (customer support agent, Claude Code codegen, multi-agent research, developer productivity, CI/CD, structured data extraction).
- Scoring mechanics: scaled 100–1,000, pass mark 720, pass/fail only, no penalty for guessing — never leave a blank.
- Distractor literacy: the recurring wrong-answer shapes — model-swap ("switch to Opus"), prompt-as-enforcement, over-engineering (classifiers/routing layers when a criteria fix suffices), more-tokens/more-context.
- Model family (Haiku/Sonnet/Opus) as background vocabulary only: the exam uses model selection in *distractors*, not as a tested topic. Know the latency/cost/capability tradeoffs so you can recognize when a model swap dodges the structural fix.

**Friction zones:** Treating model choice as a tested topic and memorizing benchmark numbers. Picking "switch to Opus" under pressure. Studying by domain weight alone instead of practicing scenario judgment.

**Analogy seed:** The exam guide is a trail map. The weights show where the elevation is; the distractors are false trails that look freshly groomed precisely so you'll take them.
```

- [ ] **Step 3: Extend the Hour 2 section**

In `### Hour 2 — Context Window Management`, replace the **Topics** list with:

```markdown
**Topics:**
- Context window vs `max_tokens` — they are different numbers, often confused.
- The `system` block, conversation history, message structure.
- Strategies: sliding window, summarization compaction, RAG, fact extraction.
- The "lost in the middle" effect: models attend reliably to the start and end of long inputs — put key-findings summaries first and use explicit section headers.
- A persistent "case facts" block: extract transactional facts (amounts, dates, order numbers, statuses) into a structured block included in every prompt, outside summarized history, so progressive summarization can't blur them.
- Trimming verbose tool results to only relevant fields *before* they accumulate (a 40-field order lookup when 5 fields matter).
- When the long-context approach beats RAG and when it doesn't.
```

and append to the **Friction zones** paragraph:

```markdown
Progressive summarization that turns "$847.50 refund by Friday" into "a refund was discussed". Letting raw tool outputs pile up turn after turn.
```

- [ ] **Step 4: Replace the Hour 3 section**

Replace everything from `### Hour 3 — Token Mechanics & Cost Optimization` up to (not including) `### Hour 4` with:

```markdown
### Hour 3 — Batch Processing & Extraction Quality

**Objectives:** Match synchronous vs Message Batches API to workflow latency tolerance. Design validation-retry loops that know their own limits. Route low-confidence extractions to human review with calibrated thresholds.

**Topics:**
- Message Batches API: 50% cost savings, up to 24-hour processing window, **no guaranteed latency SLA**, `custom_id` for request/response correlation, no multi-turn tool calling within a batch request.
- Matching API to workflow: blocking work (pre-merge checks) stays synchronous; latency-tolerant work (overnight reports, weekly audits, nightly test generation) goes to batch.
- Failure handling: resubmit only the failed `custom_id`s, with modifications (e.g., chunking documents that blew the context limit). Refine prompts on a sample set before batching large volumes.
- Retry-with-error-feedback: resend the document + failed extraction + specific validation error. Know when retries CANNOT work — the information simply isn't in the source document.
- Field-level confidence scores, calibrated against labeled validation sets — never raw self-reported confidence.
- Stratified random sampling of high-confidence extractions to measure error rates and catch novel failure patterns.
- Segment accuracy by document type and field: a 97% aggregate can hide a failing segment.

**Friction zones:** Putting a blocking workflow on the batch API because "it's usually fast". Retrying an extraction whose data isn't in the document. Trusting aggregate accuracy. Using uncalibrated self-reported confidence for review routing.

**Analogy seed:** Batch vs sync is overnight freight vs a courier — half the price if nobody is standing at the door waiting. Confidence calibration is a bathroom scale you verify against known weights before you trust its readings.
```

- [ ] **Step 5: Extend the Hour 4 section**

In `### Hour 4 — Structured Outputs (JSON Mode)`, append to the **Topics** list:

```markdown
- Schema design details the exam tests: optional/nullable fields so the model returns `null` instead of fabricating values for required fields; enum + `"other"` + detail-string for extensible categories; an `"unclear"` enum value for ambiguous cases.
- Strict schemas via tool use eliminate *syntax* errors but not *semantic* errors (line items that don't sum to the stated total) — validate semantics separately, e.g. extract `calculated_total` alongside `stated_total` and flag discrepancies.
```

and append to **Friction zones**:

```markdown
Marking every field required and forcing fabrication. Assuming schema compliance means the values are correct.
```

- [ ] **Step 6: Extend the Hour 6 section**

In `### Hour 6 — Tool Calling Patterns`, append to the **Topics** list:

```markdown
- Tool-count degradation: 18 tools instead of 4–5 measurably degrades selection reliability. Scope each agent's tool set to its role.
- Scoped cross-role tools for high-frequency needs (a `verify_fact` tool for a synthesis agent) while routing complex cases through the coordinator.
```

and append to **Friction zones**:

```markdown
Granting every agent every tool "to be flexible".
```

- [ ] **Step 7: Update hour-topics.ts entries 1 and 3**

In `src/lib/hour-topics.ts` replace:

```typescript
  1: "Diagnostic + Model Family Map",
```
with
```typescript
  1: "Diagnostic + Exam Map & Distractor Literacy",
```
and
```typescript
  3: "Token Mechanics & Cost Optimization",
```
with
```typescript
  3: "Batch Processing & Extraction Quality",
```

- [ ] **Step 8: Validate and build**

Run: `npm run validate:content`
Expected: PASS (hour titles back in sync). If it fails on hour 1 or 3, the heading text and `HOUR_TOPICS` differ — fix to match exactly.
Run: `npm run build`
Expected: compiles with no type errors.

- [ ] **Step 9: Commit**

```bash
git add .claude/skills/curriculum.md src/lib/hour-topics.ts
git commit -m "feat(curriculum): align Week 1 with exam guide (exam map, batches, extraction quality)"
```

---

### Task 3: Curriculum Week 2 rewrite (Hours 8, 10, 11, 12)

**Files:**
- Modify: `.claude/skills/curriculum.md` (Hours 8, 10, 11, 12)
- Modify: `src/lib/hour-topics.ts` (entries 8, 10, 11)

- [ ] **Step 1: Replace the Hour 8 section**

Replace everything from `### Hour 8 — MCP Architecture (Transport, Protocol, Lifecycle)` up to (not including) `### Hour 9` with:

```markdown
### Hour 8 — MCP Integration & Configuration

**Objectives:** Configure MCP servers at the right scope. Use MCP resources to cut exploratory tool calls. Select built-in tools (Read/Write/Edit/Bash/Grep/Glob) correctly.

**Topics:**
- The host / client / server model in one diagram — background only. (Transports, JSON-RPC framing, and lifecycle internals are Level-300 material and explicitly NOT on this exam.)
- Project-scoped `.mcp.json` (version-controlled, shared with the team) vs user-scoped `~/.claude.json` (personal/experimental servers). Both available simultaneously; all configured servers' tools are discovered at connection time.
- Environment-variable expansion in `.mcp.json` (e.g. `${GITHUB_TOKEN}`) — credentials never committed.
- MCP resources as content catalogs (issue summaries, documentation hierarchies, DB schemas) so agents see what data exists without exploratory tool calls.
- Community MCP servers over custom builds for standard integrations (Jira); custom servers reserved for team-specific workflows.
- Built-in tools: Grep for content search, Glob for path patterns (`**/*.test.tsx`), Read/Write for full files, Edit for unique-anchor modifications — with Read + Write as the fallback when Edit's anchor isn't unique. Explore incrementally: Grep for entry points, then Read to follow imports — not "read everything upfront".

**Friction zones:** Committing secrets instead of `${VAR}` expansion. Putting a team server in user scope (teammates silently lack it). Building a custom server where a community one exists. Reading the whole repo before searching it.

**Analogy seed:** `.mcp.json` vs `~/.claude.json` is the office toolbox vs the multitool on your own keychain — the office one is stocked for everyone, yours travels with you.
```

- [ ] **Step 2: Replace the Hour 10 section**

Replace everything from `### Hour 10 — Designing Secure, Stateful Custom Tools` up to (not including) `### Hour 11` with:

```markdown
### Hour 10 — Tool Interface Design & Structured Errors

**Objectives:** Write tool descriptions that drive correct selection among similar tools. Design error responses an agent can actually act on.

**Topics:**
- Descriptions are the PRIMARY mechanism for tool selection. Include input formats, example queries, edge cases, and explicit boundaries vs similar tools.
- Fixing misrouting: rename overlapping tools (`analyze_content` → `extract_web_results`), split generic tools into purpose-specific ones (`analyze_document` → `extract_data_points` / `summarize_content` / `verify_claim_against_source`).
- System-prompt keyword sensitivity can override good descriptions — review prompts for accidental tool associations.
- The error taxonomy the exam tests: **transient** (timeout, service down) vs **validation** (bad input) vs **business** (policy violation) vs **permission**. The MCP `isError` flag.
- Structured error metadata: `errorCategory`, `isRetryable` boolean, human-readable description. `retriable: false` + customer-friendly text for business-rule violations.
- Access failures (need a retry decision) are NOT valid empty results (successful query, no matches) — report them differently.
- Subagents recover locally from transient failures; they propagate only what they can't resolve, with partial results and what was attempted.
- (Auth patterns trimmed to one line: credentials live in env vars, never in tool descriptions. OAuth/key-rotation depth is out of exam scope.)

**Friction zones:** Descriptions like "does the thing". A uniform "Operation failed" for every error class. Retry storms on business errors. Treating "no matches" as an outage.

**Analogy seed:** A good error is an airline announcement: "delayed 30 minutes, mechanical, rebooking at gate 12" lets you act. "Flight disrupted" does not.
```

- [ ] **Step 3: Replace the Hour 11 section**

Replace everything from `### Hour 11 — Agent Pattern: Router` up to (not including) `### Hour 12` with:

```markdown
### Hour 11 — Error Propagation & Provenance in Multi-Agent Systems

**Objectives:** Design failure flows a coordinator can recover from. Preserve claim-source mappings through synthesis. Handle conflicting and temporal data correctly.

**Topics:**
- Structured error context to the coordinator: failure type, attempted query, partial results, potential alternative approaches.
- The three anti-patterns: silent suppression (returning empty-as-success), generic statuses ("search unavailable"), and terminating the whole workflow on one failure.
- Coverage annotations in synthesis output: which findings are well-supported vs which topic areas have gaps from unavailable sources.
- Claim-source mappings (source URL, document name, excerpt) that downstream agents must PRESERVE through summarization — attribution dies in compression unless it's structured.
- Conflicting statistics from credible sources: annotate both with attribution; never arbitrarily pick one or average them. The coordinator decides reconciliation.
- Temporal data: require publication/collection dates in structured outputs so a 2023-vs-2025 difference isn't misread as a contradiction.
- Render content appropriately in synthesis: financial data as tables, news as prose, technical findings as structured lists.

**Friction zones:** "Search unavailable" hiding everything the coordinator needed. Summarizers stripping attribution. Cherry-picking one of two conflicting figures.

**Analogy seed:** Provenance is evidence chain-of-custody. A lab result without its labeled bag and timestamps is inadmissible — no matter how good the lab work was.
```

- [ ] **Step 4: Extend the Hour 12 section**

In `### Hour 12 — Agent Pattern: Orchestrator-Workers`, append to the **Topics** list:

```markdown
- Simple classification routing ("which queue does this belong to?") is the degenerate single-level case of this pattern — a coordinator that only routes. (Absorbs the old Router hour.)
- The coordinator's iterative refinement loop: evaluate synthesis output for gaps → re-delegate targeted queries to search/analysis workers → re-synthesize until coverage is sufficient.
- Dynamic subagent selection: analyze the query and invoke only the subagents it needs, instead of always running the full pipeline.
- Structured handoff summaries for human escalation: customer ID, root cause, amounts, recommended action — the human has no access to the transcript.
```

and append to **Friction zones**:

```markdown
Decomposition so narrow it leaves coverage gaps between workers (the exam's favorite root-cause question). Escalating to a human with no structured handoff.
```

- [ ] **Step 5: Update hour-topics.ts entries 8, 10, 11**

In `src/lib/hour-topics.ts` replace entries:

```typescript
  8: "MCP Architecture (Transport, Protocol, Lifecycle)",
```
→
```typescript
  8: "MCP Integration & Configuration",
```
```typescript
  10: "Designing Secure, Stateful Custom Tools",
```
→
```typescript
  10: "Tool Interface Design & Structured Errors",
```
```typescript
  11: "Agent Pattern: Router",
```
→
```typescript
  11: "Error Propagation & Provenance in Multi-Agent Systems",
```

- [ ] **Step 6: Validate and build**

Run: `npm run validate:content` — Expected: PASS
Run: `npm run build` — Expected: no type errors

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/curriculum.md src/lib/hour-topics.ts
git commit -m "feat(curriculum): align Week 2 with exam guide (MCP config, error taxonomy, provenance)"
```

---

### Task 4: Curriculum Week 3 rewrite (Hours 15–19 + week heading)

**Files:**
- Modify: `.claude/skills/curriculum.md` (Week 3 heading; Hours 15, 16, 17, 18, 19)
- Modify: `src/lib/hour-topics.ts` (entries 15, 16, 18, 19)

- [ ] **Step 1: Replace the Week 3 heading**

Replace:
```markdown
## Week 3 — Enterprise Architecture & Security (Hours 15–19)
```
with:
```markdown
## Week 3 — Claude Code Configuration & Production Workflows (Hours 15–19)
```

- [ ] **Step 2: Replace the Hour 15 section**

Replace everything from `### Hour 15 — Data Privacy & PII Handling` up to (not including) `### Hour 16` with:

```markdown
### Hour 15 — CLAUDE.md Hierarchy & Path-Scoped Rules

**Objectives:** Place instructions at the correct hierarchy level. Keep CLAUDE.md modular with @import and rules files. Diagnose "Claude ignores my conventions" by checking what's actually loaded.

**Topics:**
- The hierarchy: user-level `~/.claude/CLAUDE.md` (personal, NOT shared via version control), project-level (root `CLAUDE.md` or `.claude/CLAUDE.md`, shared with the team), directory-level (subdirectory `CLAUDE.md` files).
- The classic diagnosis: a new teammate doesn't get the team's instructions because they live in someone's user-level file.
- `@import` syntax to reference external standards files — keep each package's CLAUDE.md slim and selective.
- `.claude/rules/` topic files (`testing.md`, `api-conventions.md`) instead of one monolith.
- Path-scoped rules: YAML frontmatter `paths: ["terraform/**/*"]` so a rule loads only when editing matching files — less irrelevant context, fewer tokens.
- Glob rules beat directory-level CLAUDE.md when a convention spans directories (test files everywhere: `**/*.test.tsx`).
- `/memory` to verify which memory files are loaded when behavior is inconsistent across sessions.

**Friction zones:** Team standards in user scope. One 2,000-line CLAUDE.md. Directory files for conventions that cut across the tree. Never checking `/memory` when instructions "randomly" stop applying.

**Analogy seed:** User-level is your personal notebook, project-level is the building code, directory-level is the sign on one room's door. Path-scoped rules are dress codes that apply by occasion, not by address.
```

- [ ] **Step 3: Replace the Hour 16 section**

Replace everything from `### Hour 16 — Prompt Injection Mitigation` up to (not including) `### Hour 17` with:

```markdown
### Hour 16 — Slash Commands, Skills & Plan Mode

**Objectives:** Scope commands and skills correctly. Use skill frontmatter deliberately. Choose plan mode vs direct execution by task complexity, and protect the main context during exploration.

**Topics:**
- Slash commands: project `.claude/commands/` (version-controlled, every developer gets them on clone/pull) vs personal `~/.claude/commands/`.
- Skills in `.claude/skills/` with SKILL.md frontmatter: `context: fork` (run in an isolated sub-agent context so verbose output doesn't pollute the main conversation), `allowed-tools` (restrict tool access during the skill), `argument-hint` (prompt for required parameters).
- Personal skill variants under different names in `~/.claude/skills/` so teammates aren't affected.
- Skills (on-demand, task-specific workflows) vs CLAUDE.md (always-loaded universal standards).
- Plan mode: for large-scale changes, multiple valid approaches, architectural decisions, multi-file modifications — explore and design before committing. Direct execution: well-scoped changes (single-file fix with a clear stack trace). Combine: plan the migration, then execute the plan.
- The Explore subagent isolates verbose discovery output and returns summaries — main context survives multi-phase tasks.
- `/compact` when extended sessions fill with discovery output; scratchpad files persisting key findings across context boundaries; crash recovery via structured state manifests the coordinator reloads on resume.

**Friction zones:** Skipping plan mode on architectural work ("I'll switch if it gets complex" — the complexity is already in the requirements). Verbose skills without `context: fork`. Six-hour sessions that never compact and start citing "typical patterns" instead of the actual code.

**Analogy seed:** Plan mode is the architect's site survey before demolition day. The Explore subagent is sending a scout who returns with a one-page report instead of marching the whole army through the swamp.
```

- [ ] **Step 4: Extend the Hour 17 section**

In `### Hour 17 — Guardrails: Multi-Layer Defense`, append to the **Topics** list:

```markdown
- Escalation design (the other half of this hour): explicit escalation criteria with few-shot examples in the system prompt are the CORRECT, proportionate fix when the agent's decision boundaries are unclear — this is not "prompt-as-guardrail", it's criteria definition.
- Honor an explicit customer request for a human immediately; acknowledge frustration but offer resolution when the issue is in capability — escalate if they reiterate.
- Escalate on policy gaps (the policy is silent or ambiguous on this case), not just "hard" cases.
- Multiple customer matches → ask for additional identifiers; never pick by heuristic.
- The proportionality principle: hooks for rules that must NEVER break (deterministic compliance); prompt criteria for judgment calibration. Sentiment and self-reported confidence are unreliable proxies for both.
```

and append to **Friction zones**:

```markdown
Over-correcting into "every fix must be a hook" — the exam also punishes over-engineering when explicit criteria would do.
```

- [ ] **Step 5: Replace the Hour 18 section**

Replace everything from `### Hour 18 — Prompt Caching Deep Dive` up to (not including) `### Hour 19` with:

```markdown
### Hour 18 — Claude Code in CI/CD & Iterative Refinement

**Objectives:** Run Claude Code headless in pipelines with structured output. Design reviews that don't re-litigate or duplicate. Apply iterative refinement techniques instead of prose-tweaking.

**Topics:**
- `-p` / `--print` for non-interactive mode — the fix when a CI job hangs waiting for input.
- `--output-format json` with `--json-schema`: machine-parseable findings for automated inline PR comments.
- CLAUDE.md as the context mechanism for CI-invoked Claude Code: testing standards, fixture conventions, review criteria — better test generation, less low-value output.
- Session context isolation: the session that generated code is worse at reviewing it than an independent instance (it inherits its own reasoning). Use a fresh instance for review.
- Re-running reviews after new commits: include prior findings, instruct "report only new or still-unaddressed issues".
- Provide existing test files so test generation doesn't duplicate covered scenarios.
- Iterative refinement: 2–3 concrete input/output examples beat prose when descriptions are interpreted inconsistently; test-driven iteration (write the suite, share the failures); the interview pattern (have Claude ask questions to surface considerations first); interacting fixes in ONE message, independent fixes sequentially.
- Prompt caching exists and saves input cost — that one sentence is all the exam needs.

**Friction zones:** Pipelines without `-p`. Self-review by the generating session. Duplicate review comments on every push. "Be more careful" instead of two examples.

**Analogy seed:** `-p` is mailing written instructions vs phoning someone who must pick up. Independent review is a fresh reader marking up your essay — you can't proofread what you just wrote.
```

- [ ] **Step 6: Replace the Hour 19 section**

Replace everything from `### Hour 19 — Prompt Engineering Optimization for Production` up to (not including) the `## Week 4` heading with:

```markdown
### Hour 19 — Prompt Engineering: Explicit Criteria & Few-Shot

**Objectives:** Replace vague instructions with explicit categorical criteria. Deploy few-shot examples where they actually move the needle. Manage false positives as a trust budget.

**Topics:**
- Explicit criteria beat vague instructions: "flag comments only when claimed behavior contradicts actual code behavior", not "check that comments are accurate".
- Why "be conservative" / "only report high-confidence findings" do NOT improve precision — specific categorical criteria do.
- False positives spend trust: one noisy category undermines confidence in the accurate ones. Temporarily disable a high-FP category while you fix its prompt.
- Severity definitions with a concrete code example per level → consistent classification.
- Few-shot: the most effective technique for consistent format and ambiguous-case handling. 2–4 targeted examples showing *why* one action beat the plausible alternative; examples demonstrating the desired output shape (location, issue, severity, suggested fix); examples that distinguish acceptable patterns from genuine issues; varied-format extraction examples to stop empty/null extractions.
- `detected_pattern` fields in structured findings → systematic analysis of what developers dismiss.
- Few-shot generalizes to novel patterns; it is not a lookup table of pre-approved cases.

**Friction zones:** Adding more rules instead of two good examples. Confidence-based filtering instead of categorical criteria. Treating the prompt as write-once.

**Analogy seed:** "No parking 4–6pm weekdays" gets compliance; "park considerately" gets opinions. Teaching by worked example beats the policy manual every time.
```

- [ ] **Step 7: Update hour-topics.ts entries 15, 16, 18, 19**

```typescript
  15: "Data Privacy & PII Handling",
```
→
```typescript
  15: "CLAUDE.md Hierarchy & Path-Scoped Rules",
```
```typescript
  16: "Prompt Injection Mitigation",
```
→
```typescript
  16: "Slash Commands, Skills & Plan Mode",
```
```typescript
  18: "Prompt Caching Deep Dive",
```
→
```typescript
  18: "Claude Code in CI/CD & Iterative Refinement",
```
```typescript
  19: "Prompt Engineering Optimization for Production",
```
→
```typescript
  19: "Prompt Engineering: Explicit Criteria & Few-Shot",
```

- [ ] **Step 8: Validate and build**

Run: `npm run validate:content` — Expected: PASS
Run: `npm run build` — Expected: no type errors

- [ ] **Step 9: Commit**

```bash
git add .claude/skills/curriculum.md src/lib/hour-topics.ts
git commit -m "feat(curriculum): replace out-of-scope Week 3 with Claude Code configuration (Domain 3)"
```

---

### Task 5: Curriculum Week 4 additions (Hours 20–23)

**Files:**
- Modify: `.claude/skills/curriculum.md` (Hours 20, 21, 22, 23 — additions only, no title changes)

- [ ] **Step 1: Extend Hour 20**

In `### Hour 20 — Multi-Agent Orchestration (Hub & Spoke)`, append to **Topics**:

```markdown
- `AgentDefinition` configuration: each subagent type gets a description, its own system prompt, and tool restrictions — the description is how the coordinator picks it.
- Structured data formats separating content from metadata (source URLs, document names, page numbers) when passing context between agents, so attribution survives.
- Coordinator prompts that specify research goals and quality criteria — not step-by-step procedures — so subagents can adapt.
```

- [ ] **Step 2: Extend Hour 21**

In `### Hour 21 — Session Management & Workflows`, append to **Topics**:

```markdown
- The resume-vs-fresh decision the exam tests directly: `--resume` when prior context is mostly valid; start FRESH with an injected structured summary when prior tool results are stale — resuming with stale tool results is worse than a clean summary.
- When resuming after code changed, tell the agent exactly which files changed for targeted re-analysis instead of full re-exploration.
```

- [ ] **Step 3: Update Hour 22 scoring note**

In `### Hour 22 — Full Mock Exam #1 + Remediation`, replace the topic line:

```markdown
- Score by domain (Agentic / Tool & MCP / Claude Code / Prompts / Context).
```
with:
```markdown
- Score by domain (Agentic / Tool & MCP / Claude Code / Prompts / Context). Remind the student the real exam reports a scaled score of 100–1,000 with a 720 pass mark — the mock percentage is a proxy, not the same scale.
```

- [ ] **Step 4: Update Hour 23 mechanics**

In `### Hour 23 — Full Mock Exam #2 + Final Review + Exam Strategy`, replace the exam-day strategy line:

```markdown
- Exam-day strategy: pacing (2 min/question), distractor analysis, when to mark and skip, no penalty for guessing so leave nothing blank.
```
with:
```markdown
- Exam-day strategy: distractor analysis, when to mark and skip, no penalty for guessing so leave nothing blank. The official guide (v0.1) does not state question count or time limit — verify both on the exam portal before booking; pace off the verified numbers. Expect questions framed by 4 of the 6 published scenarios.
```

- [ ] **Step 5: Validate and commit**

Run: `npm run validate:content` — Expected: PASS

```bash
git add .claude/skills/curriculum.md
git commit -m "feat(curriculum): Week 4 additions (AgentDefinition, resume-vs-fresh, exam mechanics)"
```

---

### Task 6: Concept seed, retired question, ledger template, ledger renderer

These move together — the validator's referential checks fail if split.

**Files:**
- Modify: `src/lib/concept-seed.ts` (full replacement of `CONCEPT_SEED`)
- Modify: `src/lib/question-seed.ts` (delete one question, re-tag 4 domains)
- Modify: `.claude/skills/state-template.md` (Concept Mastery section)
- Modify: `src/lib/ledger-render.ts:73-79` (week group labels)

- [ ] **Step 1: Replace the CONCEPT_SEED array**

In `src/lib/concept-seed.ts`, replace the entire `CONCEPT_SEED` array (keep the type definition above it) with:

```typescript
export const CONCEPT_SEED: ConceptSeed[] = [
  // Week 1 — API foundations & extraction quality
  { slug: "model-selection",            name: "Model Selection & Distractor Literacy",                week: 1, domain: "Agentic",     sortOrder: 10 },
  { slug: "context-window-mgmt",        name: "Context Window Management",                            week: 1, domain: "Context",     sortOrder: 20 },
  { slug: "batch-extraction-quality",   name: "Batch Processing & Extraction Quality",                week: 1, domain: "Prompts",     sortOrder: 30 },
  { slug: "structured-outputs",         name: "Structured Outputs (JSON Mode)",                       week: 1, domain: "Prompts",     sortOrder: 40 },
  { slug: "tool-calling-mechanics",     name: "Tool Calling Mechanics",                               week: 1, domain: "Tool & MCP",  sortOrder: 50 },
  { slug: "tool-calling-patterns",      name: "Tool Calling Patterns",                                week: 1, domain: "Tool & MCP",  sortOrder: 60 },
  // Week 2 — MCP, tools & agentic patterns
  { slug: "mcp-architecture",           name: "MCP Integration & Configuration",                      week: 2, domain: "Tool & MCP",  sortOrder: 110 },
  { slug: "mcp-primitives",             name: "MCP Primitives (Tools / Resources / Prompts)",         week: 2, domain: "Tool & MCP",  sortOrder: 120 },
  { slug: "tool-interface-errors",      name: "Tool Interface Design & Structured Errors",            week: 2, domain: "Tool & MCP",  sortOrder: 130 },
  { slug: "skill-vs-tool",              name: "Skill vs Tool boundary",                               week: 2, domain: "Claude Code", sortOrder: 140 },
  { slug: "error-propagation-provenance", name: "Error Propagation & Provenance",                     week: 2, domain: "Context",     sortOrder: 150 },
  { slug: "agent-pattern-orch",         name: "Agent Pattern: Orchestrator-Workers",                  week: 2, domain: "Agentic",     sortOrder: 160 },
  { slug: "agent-pattern-eval",         name: "Agent Pattern: Evaluator-Optimizer",                   week: 2, domain: "Agentic",     sortOrder: 170 },
  { slug: "agentic-loop-termination",   name: "Agentic Loop & Termination (stop_reason)",             week: 2, domain: "Agentic",     sortOrder: 180 },
  // Week 3 — Claude Code & production workflows
  { slug: "claude-md-rules",            name: "CLAUDE.md Hierarchy & Path-Scoped Rules",              week: 3, domain: "Claude Code", sortOrder: 210 },
  { slug: "skills-commands-planmode",   name: "Slash Commands, Skills & Plan Mode",                   week: 3, domain: "Claude Code", sortOrder: 220 },
  { slug: "guardrails",                 name: "Guardrails (Hooks, Tool Gating, Escalation)",          week: 3, domain: "Agentic",     sortOrder: 230 },
  { slug: "cicd-refinement",            name: "Claude Code in CI/CD & Iterative Refinement",          week: 3, domain: "Claude Code", sortOrder: 240 },
  { slug: "prompt-engineering",         name: "Prompt Engineering: Explicit Criteria & Few-Shot",     week: 3, domain: "Prompts",     sortOrder: 250 },
  // Week 4 — Agentic deep-dive & exam sim
  { slug: "multi-agent-orchestration",  name: "Multi-Agent Orchestration (Hub & Spoke)",              week: 4, domain: "Agentic",     sortOrder: 410 },
  { slug: "session-management",         name: "Session Management & Workflows",                       week: 4, domain: "Agentic",     sortOrder: 420 },
  // Cross-cutting
  { slug: "multi-instance-review",      name: "Multi-instance Review pattern",                        week: 0, domain: "Prompts",     sortOrder: 320 },
];
```

(Retired vs the old array: `token-mechanics-cost`, `stateful-tools-security`, `agent-pattern-router`, `data-privacy-pii`, `prompt-injection`, `prompt-caching`, `error-handling-resp`.)

- [ ] **Step 2: Delete the retired question and re-tag guardrails questions**

In `src/lib/question-seed.ts`:

1. Delete the entire `prompt-caching-breakpoint-placement` question object (the element whose `slug` is `"prompt-caching-breakpoint-placement"`).
2. In ALL FOUR questions with `conceptSlug: "guardrails"` (`guardrails-pretooluse-hook`, `guardrails-posttooluse-normalize`, `guardrails-confidence-escalation`, `guardrails-sentiment-escalation`), change `domain: "Claude Code"` to `domain: "Agentic"`.

- [ ] **Step 3: Replace the Concept Mastery section in state-template.md**

In `.claude/skills/state-template.md`, replace everything between `## [Concept Mastery]` and `Legend: 0–39 broken | 40–59 weak | 60–79 working | 80–100 strong.` (keeping both those lines) with:

```markdown
Track each concept area as a percentage. Update after every session that touched the area.

### Week 1 — API foundations & extraction quality
- Model Selection & Distractor Literacy: <%>
- Context Window Management: <%>
- Batch Processing & Extraction Quality: <%>
- Structured Outputs (JSON Mode): <%>
- Tool Calling Mechanics: <%>
- Tool Calling Patterns: <%>

### Week 2 — MCP, tools & agentic patterns
- MCP Integration & Configuration: <%>
- MCP Primitives (Tools / Resources / Prompts): <%>
- Tool Interface Design & Structured Errors: <%>
- Skill vs Tool boundary: <%>
- Error Propagation & Provenance: <%>
- Agent Pattern: Orchestrator-Workers: <%>
- Agent Pattern: Evaluator-Optimizer: <%>
- Agentic Loop & Termination (stop_reason): <%>

### Week 3 — Claude Code & production workflows
- CLAUDE.md Hierarchy & Path-Scoped Rules: <%>
- Slash Commands, Skills & Plan Mode: <%>
- Guardrails (Hooks, Tool Gating, Escalation): <%>
- Claude Code in CI/CD & Iterative Refinement: <%>
- Prompt Engineering: Explicit Criteria & Few-Shot: <%>

### Week 4 — Agentic deep-dive & exam sim
- Multi-Agent Orchestration (Hub & Spoke): <%>
- Session Management & Workflows: <%>

### Cross-cutting
- Multi-instance Review pattern: <%>

```

- [ ] **Step 4: Update week labels in ledger-render.ts**

In `src/lib/ledger-render.ts`, replace the `weekGroups` array (currently lines 73–79):

```typescript
  const weekGroups: Array<{ label: string; weekNum: number }> = [
    { label: "Week 1 — API foundations & extraction quality", weekNum: 1 },
    { label: "Week 2 — MCP, tools & agentic patterns", weekNum: 2 },
    { label: "Week 3 — Claude Code & production workflows", weekNum: 3 },
    { label: "Week 4 — Agentic deep-dive & exam sim", weekNum: 4 },
    { label: "Cross-cutting", weekNum: 0 },
  ];
```

- [ ] **Step 5: Validate and build**

Run: `npm run validate:content`
Expected: PASS — 22 concepts, 17 questions. If check 1 fails, a question still references a retired slug; if check 5 fails, a renamed concept's exact name string is missing from state-template.md.
Run: `npm run build` — Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/concept-seed.ts src/lib/question-seed.ts .claude/skills/state-template.md src/lib/ledger-render.ts
git commit -m "feat(seeds): retire out-of-scope concepts, add Domain 3/4/5 concepts, re-tag domains"
```

---

### Task 7: New seed questions (8)

**Files:**
- Modify: `src/lib/question-seed.ts` (append 8 questions before the closing `];`)

- [ ] **Step 1: Append the 8 new question objects**

Append before the closing `];` of `QUESTION_SEED`:

```typescript
  // ─── Domain 3: Claude Code Configuration & Workflows ────────────────────────
  {
    slug: "claude-md-path-rules",
    conceptSlug: "claude-md-rules",
    domain: "Claude Code",
    stem: "Your codebase has distinct conventions per area: React components use hooks, API handlers use async/await with specific error handling, and DB models follow a repository pattern. Test files live beside the code they test (e.g. `Button.test.tsx` next to `Button.tsx`) all over the tree, and every test must follow the same conventions regardless of location. What's the most maintainable way to make Claude apply the right conventions automatically?",
    options: {
      A: "Create rule files in `.claude/rules/` with YAML frontmatter `paths` glob patterns so conventions load conditionally by file path",
      B: "Consolidate every convention into the root CLAUDE.md under per-area headers and rely on Claude to infer which section applies",
      C: "Create one skill per code area in `.claude/skills/`, each carrying that area's conventions in its SKILL.md body",
      D: "Place a separate CLAUDE.md in each subdirectory containing that directory's specific conventions",
    },
    correctKey: "A",
    distractorReasons: {
      A: "Correct. Path-scoped rules (`paths: [\"**/*.test.tsx\"]`) apply conventions by file pattern regardless of directory — exactly what spread-out test files need.",
      B: "Relying on inference from headers is unreliable; nothing guarantees the right section is applied to the right file.",
      C: "Skills are invoked on demand for workflows — they aren't deterministically loaded by file path, so 'automatic' application isn't guaranteed.",
      D: "Directory-bound CLAUDE.md files can't follow a convention that cuts across many directories; you'd duplicate the test rules everywhere.",
    },
  },
  {
    slug: "plan-mode-vs-direct",
    conceptSlug: "skills-commands-planmode",
    domain: "Claude Code",
    stem: "You've been assigned to restructure a monolithic application into microservices — changes across dozens of files plus decisions about service boundaries and module dependencies. Which approach should you take in Claude Code?",
    options: {
      A: "Enter plan mode to explore the codebase, understand dependencies, and design the approach before making any changes",
      B: "Start in direct execution and make changes incrementally, letting the implementation reveal the natural service boundaries",
      C: "Use direct execution with comprehensive upfront instructions describing exactly how every service should be structured",
      D: "Begin in direct execution and switch to plan mode only if you hit unexpected complexity during implementation",
    },
    correctKey: "A",
    distractorReasons: {
      A: "Correct. Plan mode is built for large-scale, multi-file, architectural work — safe exploration and design before committing to changes.",
      B: "Discovering dependencies mid-rewrite is how you buy expensive rework; the boundaries should be designed, not stumbled into.",
      C: "Comprehensive upfront instructions assume you already know the right structure — without exploring the code, you don't.",
      D: "The complexity is already stated in the task (architecture, dozens of files); deferring plan mode ignores what you know now.",
    },
  },
  {
    slug: "cicd-print-flag",
    conceptSlug: "cicd-refinement",
    domain: "Claude Code",
    stem: "Your CI script runs `claude \"Review this pull request for security issues\"` but the job hangs indefinitely — logs show Claude Code waiting for interactive input. What's the correct fix for automated pipelines?",
    options: {
      A: "Add the `-p` (print) flag: `claude -p \"Review this pull request for security issues\"`",
      B: "Set `CLAUDE_HEADLESS=true` in the pipeline environment before invoking the command",
      C: "Redirect stdin from /dev/null so the process can't block on input: `claude \"...\" < /dev/null`",
      D: "Add the `--batch` flag so Claude Code queues the prompt and exits when processing completes",
    },
    correctKey: "A",
    distractorReasons: {
      A: "Correct. `-p` / `--print` is the documented non-interactive mode: process the prompt, write to stdout, exit — what CI requires.",
      B: "There is no `CLAUDE_HEADLESS` environment variable; this feature doesn't exist.",
      C: "A Unix workaround that doesn't engage Claude Code's actual non-interactive mode; behavior remains undefined.",
      D: "There is no `--batch` flag in the Claude Code CLI.",
    },
  },
  // ─── Domain 4: Batch processing ──────────────────────────────────────────────
  {
    slug: "batch-api-latency-fit",
    conceptSlug: "batch-extraction-quality",
    domain: "Prompts",
    stem: "Real-time Claude calls currently power two workflows: (1) a blocking pre-merge check developers wait on, and (2) a technical-debt report generated overnight. Your manager proposes moving both to the Message Batches API for its 50% cost savings. How should you evaluate this?",
    options: {
      A: "Move only the overnight report to batch processing; keep the pre-merge check on the synchronous API",
      B: "Move both to batch with status polling, since batches usually finish much faster than the 24-hour ceiling",
      C: "Keep both on real-time calls because batch results come back unordered and can't be matched to requests",
      D: "Move both to batch with a timeout that falls back to a real-time call whenever a batch runs long",
    },
    correctKey: "A",
    distractorReasons: {
      A: "Correct. Batch trades latency (up to 24h, no SLA) for 50% savings — ideal for overnight reports, unacceptable for a check developers block on.",
      B: "'Usually faster' is not a guarantee; a blocking workflow can't rest on a no-SLA processing window.",
      C: "A misconception — batch responses correlate to requests via `custom_id`; ordering is a non-issue.",
      D: "Needless complexity that still makes developers wait out the timeout; the clean fix is matching each workflow to the right API.",
    },
  },
  // ─── Domain 2: Structured errors ─────────────────────────────────────────────
  {
    slug: "structured-error-taxonomy",
    conceptSlug: "tool-interface-errors",
    domain: "Tool & MCP",
    stem: "Every tool on your MCP server returns the string \"Operation failed.\" on any failure — timeouts, invalid input, and policy violations alike. The agent retries policy-violation failures in a loop and gives up immediately on transient timeouts. What change most effectively fixes this behavior?",
    options: {
      A: "Return structured error metadata: an `errorCategory` (transient/validation/business/permission), an `isRetryable` boolean, and a human-readable description",
      B: "Add a system prompt instruction telling the agent to think carefully about whether each failure is worth retrying",
      C: "Set a global cap of three retries per tool so the policy-violation loop can never run more than three times",
      D: "Switch the agent to a more capable model that can infer the likely failure cause from surrounding context",
    },
    correctKey: "A",
    distractorReasons: {
      A: "Correct. The agent can only make good recovery decisions from structured error context — category and retryability tell it to retry timeouts and stop on policy violations.",
      B: "The agent has no signal to reason over — every failure looks identical; instruction quality can't fix missing information.",
      C: "A cap bounds the damage but fixes neither the wasted retries on business errors nor the premature give-up on transient ones.",
      D: "No model can reliably infer error class from a string that carries no class information.",
    },
  },
  // ─── Domain 5: Provenance ────────────────────────────────────────────────────
  {
    slug: "provenance-conflicting-sources",
    conceptSlug: "error-propagation-provenance",
    domain: "Context",
    stem: "Your research system's document-analysis subagent finds two credible industry reports stating different market sizes — one collected data in 2023, the other in 2025. The synthesis agent currently picks the larger figure and drops the other. What should happen instead?",
    options: {
      A: "Include both figures, each annotated with source attribution and data-collection date, and let the report distinguish them rather than silently choosing",
      B: "Use the more recent figure and discard the older one, since fresher data supersedes stale data",
      C: "Average the two figures so the report presents a single number that reflects both sources",
      D: "Send the search subagent back out repeatedly until it finds a third source that breaks the tie",
    },
    correctKey: "A",
    distractorReasons: {
      A: "Correct. Conflicting credible values get annotated with attribution and dates — temporal differences are context, not contradictions, and the reader needs both.",
      B: "Recency alone doesn't invalidate the earlier figure (different methodology/scope may explain it); silently discarding loses provenance.",
      C: "An average is a number neither source reported — it fabricates a statistic and destroys attribution.",
      D: "A third source doesn't resolve a difference that may be methodological or temporal; it delays the report and may still conflict.",
    },
  },
  // ─── Proportionality pair: prompt-level fixes that ARE correct ───────────────
  {
    slug: "tool-selection-descriptions-first",
    conceptSlug: "tool-interface-errors",
    domain: "Tool & MCP",
    stem: "Production logs show your agent frequently calls `get_customer` when users ask about orders (\"check my order #12345\") instead of `lookup_order`. Both tools have one-line descriptions (\"Retrieves customer information\" / \"Retrieves order details\") and accept similar identifier formats. What's the most effective FIRST step?",
    options: {
      A: "Add 5–8 few-shot examples to the system prompt demonstrating order queries routing to `lookup_order`",
      B: "Expand each tool's description to cover input formats, example queries, edge cases, and when to use it versus the similar tool",
      C: "Build a routing layer that parses user input each turn and pre-selects the appropriate tool from detected keywords",
      D: "Consolidate both into a single `lookup_entity` tool that accepts any identifier and picks the backend internally",
    },
    correctKey: "B",
    distractorReasons: {
      A: "Few-shot adds token overhead while leaving the root cause — undifferentiated descriptions — in place.",
      B: "Correct. Descriptions are the primary tool-selection mechanism; enriching them is the low-effort, high-leverage fix that addresses the root cause. Note: the structural options (C, D) are the over-engineered distractors here.",
      C: "Over-engineered — it bypasses the model's language understanding and adds a brittle keyword layer before simpler fixes were tried.",
      D: "A real architectural option, but far more effort than a first step warrants when the immediate defect is description quality.",
    },
  },
  {
    slug: "escalation-criteria-prompt-first",
    conceptSlug: "guardrails",
    domain: "Agentic",
    stem: "Your support agent hits 55% first-contact resolution against an 80% target. Logs show it escalates straightforward cases (standard damage replacements with photo evidence) while attempting complex policy-exception cases itself. What most effectively improves its escalation calibration?",
    options: {
      A: "Add explicit escalation criteria to the system prompt with few-shot examples showing when to escalate versus resolve autonomously",
      B: "Have the agent self-report a confidence score before each response and auto-route to humans below a threshold",
      C: "Train a separate classifier on historical tickets to predict which requests need escalation before the agent runs",
      D: "Add sentiment analysis and escalate automatically whenever customer frustration crosses a threshold",
    },
    correctKey: "A",
    distractorReasons: {
      A: "Correct. The root cause is unclear decision boundaries — explicit criteria plus few-shot examples is the proportionate fix. This is criteria definition, not prompt-as-enforcement: nothing here needs a deterministic guarantee, it needs better judgment.",
      B: "Self-reported confidence is poorly calibrated — this agent is already confidently wrong on the hard cases.",
      C: "Over-engineered: labeled data and ML infrastructure before prompt-level criteria have even been tried.",
      D: "Sentiment doesn't track case complexity — calm customers bring hard problems and angry ones bring trivial ones.",
    },
  },
```

- [ ] **Step 2: Validate and build**

Run: `npm run validate:content`
Expected: `Content validation passed: 22 concepts, 25 questions, 23 hours.`
Run: `npm run build` — Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/question-seed.ts
git commit -m "feat(questions): seed Domain 3/4/5 questions + proportionality counterweights"
```

---

### Task 8: Question bank update

**Files:**
- Modify: `.claude/skills/question-bank.md`

- [ ] **Step 1: Replace the opening paragraph (exam mechanics)**

Replace the first paragraph (starting "The real CCA-F exam is 60 scenario-based MCQs...") with:

```markdown
The real CCA-F exam is multiple-choice: one correct answer and three plausible distractors per question, scenario-based, with questions framed by 4 scenarios drawn at random from 6 published ones (customer support agent, Claude Code codegen, multi-agent research, developer productivity, CI/CD, structured data extraction). Results are a scaled score of 100–1,000 with a **720 pass mark**; unanswered questions score as wrong and there is no guessing penalty. The official guide (v0.1) does **not** state question count or time limit — verify both on the exam portal before exam day; mocks below use 60 questions / 120 minutes as a working assumption only. The hardest part of the exam is *distractor literacy* — wrong answers are designed to look reasonable.
```

- [ ] **Step 2: Fix the question template's correct-answer line**

In the Question Anatomy template, replace:

```markdown
> B) [correct answer — usually a programmatic / structural fix]
```
with:
```markdown
> B) [correct answer — the PROPORTIONATE fix: prompt-level (criteria, descriptions, examples) when the gap is judgment or information; programmatic (hooks, gates) when compliance must be deterministic]
```

- [ ] **Step 3: Add the proportionality principle to the distractor section**

After the numbered list of "The Six Common Wrong Patterns", append:

```markdown
7. **Over-engineering.** "Build a routing layer / train a classifier / add ML infrastructure." Wrong when explicit criteria, better tool descriptions, or 2–3 few-shot examples fix the root cause at a fraction of the effort.

**The proportionality principle (read this before writing any question).** "Prompt-as-guardrail" is wrong **only when the requirement is deterministic compliance** (never refund > $500 → hook). When the failure is a *judgment* gap — unclear escalation boundaries, undifferentiated tool descriptions, inconsistent output format — the prompt-level fix (explicit criteria, enriched descriptions, targeted few-shot) IS the correct answer, and the heavy structural option is the over-engineering distractor. The official sample questions test this in both directions: a hook beats a prompt rule for refund compliance, but explicit criteria + few-shot beats a classifier for escalation calibration, and richer tool descriptions beat a routing layer for tool selection. A good mock mixes both directions so the student can't pattern-match "programmatic = correct".
```

- [ ] **Step 4: Add new exemplars**

After the existing "Hooks & Escalation Signals" exemplar, append exemplar entries matching the 8 seeded questions (same scenario, options, correct answer, and distractor dissection as in Task 7 — copy each question's stem/options/reasons into the exemplar format used by the existing entries, under these headings):

```markdown
### Claude Code: Path-Scoped Rules        (mirrors seed `claude-md-path-rules`)
### Claude Code: Plan Mode vs Direct      (mirrors seed `plan-mode-vs-direct`)
### Claude Code: CI/CD Headless Mode      (mirrors seed `cicd-print-flag`)
### Batch Processing Fit                  (mirrors seed `batch-api-latency-fit`)
### Structured Error Taxonomy             (mirrors seed `structured-error-taxonomy`)
### Provenance & Conflicting Sources      (mirrors seed `provenance-conflicting-sources`)
### Proportionality: Descriptions First   (mirrors seed `tool-selection-descriptions-first`)
### Proportionality: Criteria First       (mirrors seed `escalation-criteria-prompt-first`)
```

For each heading, write the full exemplar in the file's established format (blockquote scenario, A–D options, `**Correct: X.**` plus per-distractor dissection). Use the exact content from Task 7 — do not invent new variants.

- [ ] **Step 5: Update the mini-mock target mixes**

Replace the Week 1 mini-mock target mix with:

```markdown
- 1 on model selection / distractor literacy
- 2 on context window management
- 2 on batch processing & extraction quality
- 2 on structured outputs (incl. nullable / enum-other schema design)
- 3 on tool calling mechanics & patterns
```

Replace the Week 2 mini-mock coverage line and target mix with:

```markdown
10 questions, ~15 minutes, covering: MCP integration & configuration, MCP primitives, tool interface design & structured errors, skill-vs-tool boundary, orchestrator-workers, evaluator-optimizer, agentic loop termination, error propagation & provenance.

Target mix:
- 2 on MCP integration / configuration / primitives
- 2 on tool interface design & structured errors
- 1 on skill-vs-tool boundary
- 2 on agent patterns (Orchestrator-Workers, Evaluator-Optimizer)
- 2 on agentic loop / stop_reason
- 1 on error propagation & provenance
```

- [ ] **Step 6: Replace the stale Mock 1 note**

Replace the note paragraph under Full Mock 1 (beginning "Note: the user's attached curriculum is light on Claude Code Configuration content...") with:

```markdown
Note: Week 3 (Hours 15–19) now carries the Claude Code Configuration domain (CLAUDE.md hierarchy, rules, skills frontmatter, plan mode, CI/CD flags). When generating Claude Code questions, draw on those hours plus the seeded exemplars above — and include at least two proportionality-direction questions (where the prompt-level fix is correct) so the mock can't be gamed by always picking the structural option.
```

- [ ] **Step 7: Validate and commit**

Run: `npm run validate:content` — Expected: PASS (bank is not validated programmatically; this guards the seeds you touched in passing)

```bash
git add .claude/skills/question-bank.md
git commit -m "feat(question-bank): exam mechanics, proportionality principle, Domain 3/4/5 exemplars"
```

---

### Task 9: SKILL.md prerequisite fix

**Files:**
- Modify: `.claude/skills/SKILL.md`

- [ ] **Step 1: Annotate the prerequisite list**

Replace the prerequisite list (lines beginning "The user has already completed four prerequisite courses:" through item 4) with:

```markdown
The user has already completed four prerequisite courses:

1. Introduction to Agent Skills *(not listed in the current Anthropic Academy catalog — verify the course name/availability at anthropic.skilljar.com before citing it)*
2. Building with the Claude API
3. Introduction to Model Context Protocol (MCP)
4. Claude Code in Action
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/SKILL.md
git commit -m "fix(skill): flag Agent Skills prereq as absent from current Academy catalog"
```

---

### Task 10: Seed retirement pass + DB resync

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add retirement constants and deletion pass**

In `prisma/seed.ts`, after the imports, add:

```typescript
// Concepts/questions removed from the exam-aligned curriculum. Deleting the
// concept cascades its masteries; FrictionPoint keeps its text with a null
// concept. Deleting a question cascades its attempts.
const RETIRED_CONCEPT_SLUGS = [
  "token-mechanics-cost",
  "stateful-tools-security",
  "agent-pattern-router",
  "data-privacy-pii",
  "prompt-injection",
  "prompt-caching",
  "error-handling-resp",
];
const RETIRED_QUESTION_SLUGS = ["prompt-caching-breakpoint-placement"];
```

Inside `main()`, immediately before `console.log("Seeding concepts...");`, add:

```typescript
  console.log("Retiring out-of-scope concepts/questions...");
  await prisma.question.deleteMany({
    where: { slug: { in: RETIRED_QUESTION_SLUGS } },
  });
  await prisma.concept.deleteMany({
    where: { slug: { in: RETIRED_CONCEPT_SLUGS } },
  });
```

- [ ] **Step 2: Confirm with the user before touching the DB**

If a study sprint is in progress (`~/.cca-f-tutor/cca-f.db` exists with mastery data), warn: retiring concepts deletes their mastery rows and the caching question's attempt history. Get an explicit go-ahead, or back up first:

```bash
cp ~/.cca-f-tutor/cca-f.db ~/.cca-f-tutor/cca-f.db.bak-$(date +%Y%m%d)
```

- [ ] **Step 3: Run setup (migrate + seed) and verify counts**

Run: `npm run db:setup`
Expected: "Retiring out-of-scope concepts/questions..." then seed logs, ending "Seed complete."

Run: `npx tsx scripts/check-counts.ts`
Expected: `{ concepts: 22, questions: 25, students: 1, masteries: 22 }`

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(seed): retire out-of-scope concepts and questions on seed"
```

---

### Task 11: Final verification sweep

- [ ] **Step 1: Full validator + build**

```bash
npm run validate:content && npm run build
```
Expected: both pass.

- [ ] **Step 2: Smoke the runtime paths that consume changed content**

```bash
npx tsx -e "
process.env.NODE_ENV='development';
const m = require('./src/lib/hour-topics');
for (const h of [1,3,8,10,11,15,16,18,19]) console.log(h, m.HOUR_TOPICS[h]);
"
```
Expected: the nine retitled hours print the new titles.

Start the app (`npm run dev`), open `/ledger`, and confirm: the Concept Mastery section shows the four new week labels and 22 concepts; `[Next Up]` shows a valid topic. Stop the server.

- [ ] **Step 3: Re-read edited JSON for syntax (per repo discipline)**

Re-read `package.json` in full; confirm no trailing commas or fence artifacts.

- [ ] **Step 4: Final commit (if any stragglers)**

```bash
git status --short
git add -A && git commit -m "chore: exam-guide alignment final sweep" # only if files remain
```

---

## Self-Review (completed at plan time)

- **Spec coverage:** Flag 1 → Task 4 (+ Task 6/7 concepts & questions). Flag 2 → Tasks 2 (Hours 1, 3), 3 (Hour 8), 4 (Hours 15/16/18/19 + caching cut). Flag 3 → Task 8 Steps 2–3 + Task 7 proportionality pair. Flag 4 → Tasks 2 (5.1, 4.3/4.4/4.5, 5.5, 2.3), 3 (2.2, 2.4, 2.5, 5.3, 5.6, 1.2/1.4), 4 (3.1–3.6, 5.4, 5.2), 5 (1.3, 1.7). Flag 5 → Task 8 Step 1 (mechanics), Task 6 (re-tags, week labels), Task 9 (catalog mismatch), Task 5 Steps 3–4 (mock mechanics).
- **Placeholder scan:** Task 8 Step 4 asks the engineer to transcribe Task 7 content into exemplar format rather than duplicating ~200 lines — content source is exact and named, not invented. All other steps carry full content.
- **Type consistency:** `ConceptSeed`/`QuestionSeed` shapes unchanged; new rows match existing fields. `HOUR_TOPICS` keys 1–23 all present after edits. Validator imports only existing exports (`CONCEPT_SEED`, `QUESTION_SEED`, `HOUR_TOPICS`, `DOMAIN_LABELS`).
