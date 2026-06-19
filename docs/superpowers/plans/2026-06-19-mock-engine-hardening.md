# Mock Engine Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the CCA-F app's mock predictive of the real exam — add a difficulty tier to questions, author a large above-real-exam multi-constraint question bank, stop `fetch_question` from re-serving duplicates inside a mock, harden the live-generation rubric, and recalibrate readiness so >900 in-app means genuinely ready.

**Architecture:** Questions gain a `difficulty` column (`warmup` | `hard`). Existing 33 seeds are `warmup` (single-lever checkpoints); ~70 new hand-authored questions are `hard` (multi-constraint, slightly above real-exam). `fetch_question` gains `difficulty` and `noRepeat` params: in a mock the model passes `difficulty:"hard", noRepeat:true`, and the handler never re-serves a question already attempted (all-time) or already fetched this session — on exhaustion it returns `exhausted:true` so the model generates a fresh hard question instead of repeating. `question-bank.md` carries the exam-realism rubric and the recalibrated readiness bar.

**Tech Stack:** Next.js 16 / TypeScript, Prisma 7 + libsql (SQLite), tsx scripts. No test framework — `scripts/validate-content.ts` + `npm run build` + a runtime smoke are the regression net.

## Global Constraints

- **Difficulty values are exactly `"warmup"` and `"hard"`** — no other strings. The validator enforces this.
- **`QuestionSeed.difficulty` is optional; absent means `"warmup"`.** Existing 33 entries are NOT edited; only new entries set `difficulty: "hard"`.
- **No option-letter references in `distractorReasons` text** (e.g. never "options C and D") — options are shuffled per fetch ([shuffle.ts](src/lib/tutor/shuffle.ts)), so letter references mislabel on screen. Refer to options by their content.
- **Exactly one `distractorReasons` entry begins with `"Correct."`** — the one matching `correctKey`.
- **Every question object has keys `A,B,C,D` in both `options` and `distractorReasons`**, a `correctKey` ∈ {A,B,C,D}, and a globally unique `slug`.
- **Validator must pass after every task:** `npm run validate:content`.
- **DB path is `~/.cca-f-tutor/cca-f.db`** — back it up before any `db:setup` (a study sprint is live).
- Exam domain weights (for the 60-question mock): Agentic 16, Claude Code 12, Prompts 12, Tool & MCP 11, Context 9.

---

### Task 1: Add the `difficulty` column (schema, migration, seed type, seed writer)

**Files:**
- Modify: `prisma/schema.prisma` (Question model)
- Create: `prisma/migrations/20260619000000_add_question_difficulty/migration.sql`
- Modify: `src/lib/question-seed.ts` (QuestionSeed type only)
- Modify: `prisma/seed.ts` (question upsert create+update)

**Interfaces:**
- Produces: `QuestionSeed.difficulty?: "warmup" | "hard"`; `Question.difficulty: string` (Prisma field, default `"warmup"`).

- [ ] **Step 1: Add the field to schema.prisma**

In `prisma/schema.prisma`, in `model Question`, add the `difficulty` line immediately after the `source` line:

```prisma
  source            String   @default("hand-authored")
  difficulty        String   @default("warmup")
```

- [ ] **Step 2: Create the migration file**

Create `prisma/migrations/20260619000000_add_question_difficulty/migration.sql` with exactly:

```sql
-- AlterTable
ALTER TABLE "Question" ADD COLUMN "difficulty" TEXT NOT NULL DEFAULT 'warmup';
```

- [ ] **Step 3: Extend the QuestionSeed type**

In `src/lib/question-seed.ts`, change the type (top of file) to add the optional field:

```typescript
export type QuestionSeed = {
  slug: string;
  conceptSlug: string;
  domain: string;
  stem: string;
  options: Record<string, string>;
  correctKey: string;
  distractorReasons: Record<string, string>;
  difficulty?: "warmup" | "hard";
};
```

Do NOT edit any existing question objects.

- [ ] **Step 4: Write difficulty in the seed upsert**

In `prisma/seed.ts`, inside the `for (const q of QUESTION_SEED)` loop's `prisma.question.upsert`, add `difficulty` to BOTH `create` and `update` objects. The `create` block becomes:

```typescript
      create: {
        slug: q.slug,
        conceptId: concept?.id ?? null,
        domain: q.domain,
        stem: q.stem,
        options: JSON.stringify(q.options),
        correctKey: q.correctKey,
        distractorReasons: JSON.stringify(q.distractorReasons),
        source: "hand-authored",
        difficulty: q.difficulty ?? "warmup",
      },
```

and add this line inside the `update` block (after `distractorReasons`):

```typescript
        difficulty: q.difficulty ?? "warmup",
```

- [ ] **Step 5: Regenerate the Prisma client and type-check**

Run: `npx prisma generate`
Expected: "Generated Prisma Client".
Run: `npm run build`
Expected: compiles with no type errors (the seed writer and any `difficulty` reference now type-check).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260619000000_add_question_difficulty src/lib/question-seed.ts prisma/seed.ts
git commit -m "feat(schema): add Question.difficulty tier (warmup|hard)"
```

---

### Task 2: Teach the validator about difficulty

**Files:**
- Modify: `scripts/validate-content.ts`

**Interfaces:**
- Consumes: `QuestionSeed.difficulty?` from Task 1.
- Produces: validator rejects any difficulty outside {warmup, hard} and prints a per-domain hard-tier count line.

- [ ] **Step 1: Add the difficulty checks**

In `scripts/validate-content.ts`, immediately before the final `if (errors.length)` block, add:

```typescript
// 8. difficulty is a known tier
const ALLOWED_DIFFICULTY = new Set(["warmup", "hard"]);
for (const q of QUESTION_SEED) {
  const d = q.difficulty ?? "warmup";
  if (!ALLOWED_DIFFICULTY.has(d)) {
    errors.push(`question "${q.slug}" has unknown difficulty "${d}"`);
  }
}

// Informational: hard-tier coverage per domain (mock draws from hard tier).
const hardByDomain: Record<string, number> = {};
for (const q of QUESTION_SEED) {
  if ((q.difficulty ?? "warmup") === "hard") {
    hardByDomain[q.domain] = (hardByDomain[q.domain] ?? 0) + 1;
  }
}
const hardTotal = Object.values(hardByDomain).reduce((a, b) => a + b, 0);
console.log(`Hard-tier questions: ${hardTotal} total — ${JSON.stringify(hardByDomain)}`);
```

- [ ] **Step 2: Run the validator**

Run: `npm run validate:content`
Expected: ends with `Content validation passed: 22 concepts, 33 questions, 23 hours.` and a line `Hard-tier questions: 0 total — {}` (no hard questions exist yet).

- [ ] **Step 3: Commit**

```bash
git add scripts/validate-content.ts
git commit -m "chore(validator): enforce difficulty tier + report hard-tier coverage"
```

---

### Task 3: `fetch_question` — no-repeat in a mock + difficulty filter

**Files:**
- Modify: `src/lib/tutor/tool-handlers.ts` (the `fetch_question` case, ~lines 233-330)
- Modify: `src/lib/tutor/tools.ts` (fetch_question input schema)

**Interfaces:**
- Consumes: `Question.difficulty` (Task 1).
- Produces: `fetch_question` accepts `{ conceptSlug, difficulty?, noRepeat? }`. On exhaustion with `noRepeat:true` it returns `{found:false, exhausted:true, message}` and does NOT re-serve.

- [ ] **Step 1: Replace the question-selection block**

In `src/lib/tutor/tool-handlers.ts`, the `case "fetch_question": {` block currently destructures only `conceptSlug` and selects with an attempted-all-time filter plus a re-serve fallback. Replace from the line `const { conceptSlug } = input as { conceptSlug: string };` down to the end of the `const question = (...) ?? (...);` assignment (the two chained `findFirst` calls) with:

```typescript
        const { conceptSlug, difficulty, noRepeat } = input as {
          conceptSlug: string;
          difficulty?: "warmup" | "hard";
          noRepeat?: boolean;
        };
        assertValidSlug(conceptSlug);

        // Questions the student has already attempted (all-time).
        const attempted = await prisma.questionAttempt.findMany({
          where: {
            studentId: ctx.studentId,
            question: { concept: { slug: conceptSlug } },
          },
          select: { questionId: true },
        });
        const seenIds = new Set(attempted.map((a) => a.questionId));

        // In a mock (noRepeat), also exclude anything already fetched THIS
        // session, so a 60-question mock never repeats even before the student
        // has answered.
        if (noRepeat && ctx.sessionId) {
          const fetchedThisSession = await prisma.questionFetch.findMany({
            where: { sessionId: ctx.sessionId },
            select: { questionId: true },
          });
          for (const f of fetchedThisSession) seenIds.add(f.questionId);
        }
        const excludeIds = [...seenIds];

        const baseWhere = {
          concept: { slug: conceptSlug },
          ...(difficulty ? { difficulty } : {}),
        };

        // Prefer an unseen question. If none and noRepeat is set, DO NOT
        // re-serve — signal exhaustion so the model generates a fresh one.
        let question = await prisma.question.findFirst({
          where: { ...baseWhere, id: { notIn: excludeIds } },
          orderBy: { id: "asc" },
        });
        if (!question && !noRepeat) {
          question = await prisma.question.findFirst({
            where: baseWhere,
            orderBy: { id: "asc" },
          });
        }
        if (!question) {
          return {
            content: JSON.stringify({
              found: false,
              exhausted: true,
              message: `No unseen ${difficulty ?? "any"}-tier questions remain for concept "${conceptSlug}". Generate a fresh production-grade question per the exam-realism rubric in question-bank.md, present it, and grade it yourself — do not repeat a prior question.`,
            }),
            isError: false,
          };
        }
```

Leave the rest of the case (the options-parse / shuffle / `questionFetch.create` / return) unchanged — it already operates on `question`.

- [ ] **Step 2: Add the params to the tool schema**

In `src/lib/tutor/tools.ts`, replace the `fetch_question` tool's `input_schema` with:

```typescript
    input_schema: {
      type: "object",
      properties: {
        conceptSlug: {
          type: "string",
          description: "The concept slug to fetch a question for.",
        },
        difficulty: {
          type: "string",
          enum: ["warmup", "hard"],
          description:
            "Optional tier filter. Use 'warmup' for in-hour checkpoints; use 'hard' for mock exams (Hours 7, 14, 22, 23).",
        },
        noRepeat: {
          type: "boolean",
          description:
            "Set true during mocks. Excludes any question already fetched this session; on exhaustion returns exhausted:true (generate a fresh question) instead of re-serving a duplicate.",
        },
      },
      required: ["conceptSlug"],
    },
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/tutor/tool-handlers.ts src/lib/tutor/tools.ts
git commit -m "feat(tutor): fetch_question difficulty filter + no-repeat-in-mock"
```

---

### Tasks 4–8: Author the hard-tier question bank (per domain)

Each task APPENDS new `difficulty: "hard"` question objects to `QUESTION_SEED` in `src/lib/question-seed.ts`, before the closing `];`. These are **content-authoring** tasks: the deliverable is the questions, written to the quality bar below. Run `npm run validate:content` after each.

**The exam-realism quality bar (applies to every hard question):**
1. **Multi-paragraph scenario stem** with a concrete production setting and at least **two quantified facts** (scale, latency, cost, error rate, deadline) AND at least **one hard constraint** the right answer must respect.
2. **Four options where three are genuinely defensible** — each the correct answer to a *slightly different* reading of the scenario — and exactly one is best on the stated tradeoff. No throwaway/obviously-wrong options. This is what "slightly above real exam" means: subtler distractors, more competing constraints than the real exam.
3. **Distractor reasons name the specific reason each option loses** (which constraint it violates / which root cause it misses) — not "this is wrong because A is right."
4. Obey every Global Constraint (no option-letter refs; one "Correct." prefix; unique slug; A–D keys).
5. **No stem telegraphing** — don't name the fix in the stem ("the descriptions are vague" gives it away). Describe symptoms and constraints only.

**Worked example (use as the exact shape and difficulty bar) — DO NOT re-author this one, it already exists at warmup tier; this shows the hard-tier upgrade:**

```typescript
  {
    slug: "hard-agentic-coordinator-partial-coverage",
    conceptSlug: "multi-agent-orchestration",
    domain: "Agentic",
    difficulty: "hard",
    stem: "A research coordinator fans out to four subagents and must return a cited brief within a 90-second p95 budget. On a live topic, two subagents return in 12s with strong sources, the third returns in 70s with one weak source, and the fourth is still running at the 90s deadline. Re-running the whole fan-out blows the budget; the brief is due now. Your logs show the coordinator currently waits for all four, missing the deadline 30% of the time. What change best holds the deadline without silently degrading quality?",
    options: {
      A: "At the deadline, synthesize from the subagents that returned, annotate the uncovered subtopic as a gap with the reason 'source timeout', and surface a confidence note — then let a follow-up job backfill the gap",
      B: "Drop the p95 budget to a hard 120s so all four subagents reliably finish before synthesis runs",
      C: "Cancel the two slow subagents at the deadline and re-issue their subtopics to the two fast subagents in a second round",
      D: "Have the coordinator return whatever the fastest two subagents produced and mark the brief complete",
    },
    correctKey: "A",
    distractorReasons: {
      A: "Correct. Graceful degradation with a coverage annotation holds the deadline while preserving transparency about what's unverified — the gap is surfaced, not hidden, and a follow-up closes it.",
      B: "Relaxing the budget abandons the stated p95 requirement rather than meeting it; the deadline is a constraint, not a preference.",
      C: "A second round adds round-trip latency the budget can't absorb and still has no guarantee the re-issued subtopics finish in time.",
      D: "Marking a partial brief complete hides the missing subtopic — the silent-degradation failure the requirement explicitly forbids.",
    },
  },
```

#### Task 4: Agentic hard questions (target 16)

**Files:** Modify `src/lib/question-seed.ts` (append before `];`).

- [ ] **Step 1:** Append 16 `difficulty: "hard"` questions across these concepts (counts): `multi-agent-orchestration` ×4, `agent-pattern-orch` ×3, `session-management` ×3, `agentic-loop-termination` ×2, `guardrails` ×2, `agent-pattern-eval` ×1, `model-selection` ×1. Each `domain: "Agentic"`. Slugs prefixed `hard-agentic-`. Follow the quality bar exactly. The worked example above counts as the first of the 4 `multi-agent-orchestration` questions — include it verbatim, then author 15 more.
- [ ] **Step 2:** Run `npm run validate:content`. Expected: passes; `Hard-tier questions: 16 total` with `Agentic` = 16.
- [ ] **Step 3:** `npm run build` — no type errors.
- [ ] **Step 4:** Commit: `git add src/lib/question-seed.ts && git commit -m "feat(questions): hard-tier Agentic bank (16)"`

#### Task 5: Claude Code hard questions (target 12)

**Files:** Modify `src/lib/question-seed.ts`.

- [ ] **Step 1:** Append 12 `difficulty: "hard"` questions across: `cicd-refinement` ×4, `claude-md-rules` ×3, `skills-commands-planmode` ×3, `skill-vs-tool` ×2. Each `domain: "Claude Code"`. Slugs prefixed `hard-cc-`. Lean into CI scenarios (the user's weakest real-exam area): severity-criteria vs static map, no-filter constraint, noisy-category trust, multi-pass review, headless flags, plan-mode-vs-direct under stated complexity.
- [ ] **Step 2:** `npm run validate:content` → passes; `Claude Code` hard = 12.
- [ ] **Step 3:** `npm run build`.
- [ ] **Step 4:** Commit: `git commit -am "feat(questions): hard-tier Claude Code bank (12)"`

#### Task 6: Prompts hard questions (target 12)

**Files:** Modify `src/lib/question-seed.ts`.

- [ ] **Step 1:** Append 12 `difficulty: "hard"` questions across: `prompt-engineering` ×4, `structured-outputs` ×3, `batch-extraction-quality` ×3, `multi-instance-review` ×2. Each `domain: "Prompts"`. Slugs prefixed `hard-prompts-`. Force the criteria-vs-few-shot-vs-format discrimination, nullable/enum schema design, batch mid-request limits, self-review vs independent-review.
- [ ] **Step 2:** `npm run validate:content` → passes; `Prompts` hard = 12.
- [ ] **Step 3:** `npm run build`.
- [ ] **Step 4:** Commit: `git commit -am "feat(questions): hard-tier Prompts bank (12)"`

#### Task 7: Tool & MCP hard questions (target 11)

**Files:** Modify `src/lib/question-seed.ts`.

- [ ] **Step 1:** Append 11 `difficulty: "hard"` questions across: `tool-interface-errors` ×3, `mcp-architecture` ×3, `tool-calling-patterns` ×2, `mcp-primitives` ×2, `tool-calling-mechanics` ×1. Each `domain: "Tool & MCP"`. Slugs prefixed `hard-tool-`. Force structured-error taxonomy, tool-overlap rename, scope/`.mcp.json` config, resource-vs-tool, tool_choice control under constraints.
- [ ] **Step 2:** `npm run validate:content` → passes; `Tool & MCP` hard = 11.
- [ ] **Step 3:** `npm run build`.
- [ ] **Step 4:** Commit: `git commit -am "feat(questions): hard-tier Tool & MCP bank (11)"`

#### Task 8: Context hard questions (target 9)

**Files:** Modify `src/lib/question-seed.ts`.

- [ ] **Step 1:** Append 9 `difficulty: "hard"` questions across: `error-propagation-provenance` ×3, `context-window-mgmt` ×3, `multi-agent-orchestration` ×1 (context-passing angle, `domain: "Context"`? NO — keep domain = concept's domain). Correction: use `context-window-mgmt` ×4, `error-propagation-provenance` ×5 (both are `domain: "Context"`). Each `domain: "Context"`. Slugs prefixed `hard-context-`. Force lost-in-the-middle, case-facts extraction, coverage annotations, conflicting/temporal source reconciliation, claim-source provenance through synthesis.
- [ ] **Step 2:** `npm run validate:content` → passes; `Context` hard = 9. Total hard now ≈ 60.
- [ ] **Step 3:** `npm run build`.
- [ ] **Step 4:** Commit: `git commit -am "feat(questions): hard-tier Context bank (9)"`

---

### Task 9: Exam-realism generation rubric + recalibrated readiness + mock spec

**Files:**
- Modify: `.claude/skills/question-bank.md`

- [ ] **Step 1: Add the mock difficulty + no-repeat protocol** — after the "## Question Anatomy" section, add:

```markdown
## Mock Protocol (Hours 7, 14, 22, 23)

Mocks fetch from the **hard tier** and must never repeat a question within one mock:

- Call `fetch_question` with `difficulty: "hard"` and `noRepeat: true` for every mock question.
- If it returns `exhausted: true`, the hand-authored hard bank for that concept is used up — **generate a fresh production-grade question** per the Exam-Realism Rubric below, present it, and grade it yourself. Never re-ask a prior question.
- Full mocks (Hours 22, 23) are 60 questions, 120 minutes, drawn to the exam domain weights: Agentic 16, Claude Code 12, Prompts 12, Tool & MCP 11, Context 9.
```

- [ ] **Step 2: Add the Exam-Realism Rubric** — immediately after the block from Step 1:

```markdown
## Exam-Realism Rubric (for generated hard questions)

The real exam is harder than this app's warm-up tier. A generated hard question MUST have:
1. A multi-paragraph production scenario with **≥2 quantified facts** (scale, latency, cost, error rate, deadline) and **≥1 hard constraint** the answer must respect.
2. **Four options, three genuinely defensible** — each the right answer to a slightly different reading — and one best on the stated tradeoff. No obviously-wrong filler.
3. Distractor reasons that name **which constraint each option violates or which root cause it misses** — never "wrong because another option is right", never reference options by letter (they are shuffled).
4. A stem that describes **symptoms and constraints only** — it must not name the fix.
5. Deliberately **slightly above real-exam difficulty**: subtler distractors and one more competing constraint than the candidate expects.
```

- [ ] **Step 3: Recalibrate readiness** — replace the two readiness lines under "## Full Mock 2 (Hour 23)" (currently "If Mock 2 score is ≥ 80% overall AND no domain below 60%: ready..." / "If overall < 70% OR any domain < 50%: ...") with:

```markdown
Mocks now draw from the hard tier (above real-exam difficulty), so the bar is higher and predictive:
- **Ready to sit the real exam:** hard-mock ≥ **90% overall (≈900/1000, Anthropic's own practice target)** AND no domain below **75%**.
- **Not ready — keep training:** overall < 85% OR any domain < 70%. A >900 here means genuinely ready, not falsely confident.
```

- [ ] **Step 4: Validate** — `npm run validate:content` (bank isn't programmatically parsed, but this guards the seeds). Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/question-bank.md
git commit -m "feat(question-bank): hard-tier mock protocol, exam-realism rubric, >900 readiness bar"
```

---

### Task 10: Final gate — enforce hard-bank size, reseed, smoke test

**Files:**
- Modify: `scripts/validate-content.ts` (add the count gate)

- [ ] **Step 1: Add the hard-tier size gate** — in `scripts/validate-content.ts`, immediately after the `hardTotal` computation from Task 2, add:

```typescript
// 9. The hard bank must be able to fill a 60-question mock with zero repeats.
const HARD_DOMAIN_MIN: Record<string, number> = {
  "Agentic": 16, "Claude Code": 12, "Prompts": 12, "Tool & MCP": 11, "Context": 9,
};
if (hardTotal < 60) errors.push(`hard-tier total ${hardTotal} < 60 (cannot fill a no-repeat mock)`);
for (const [dom, min] of Object.entries(HARD_DOMAIN_MIN)) {
  const have = hardByDomain[dom] ?? 0;
  if (have < min) errors.push(`hard-tier ${dom}: ${have} < required ${min}`);
}
```

- [ ] **Step 2: Run the validator** — `npm run validate:content`
Expected: passes; `Hard-tier questions: 60 total` (or more) with each domain ≥ its minimum. If it fails, the matching authoring task (4–8) under-delivered — fix there.

- [ ] **Step 3: Build** — `npm run build` — no type errors.

- [ ] **Step 4: Back up and reseed the live DB**

```bash
cp ~/.cca-f-tutor/cca-f.db ~/.cca-f-tutor/cca-f.db.bak-mockhardening-$(date +%Y%m%d)
npm run db:setup
```
Expected: migrate deploy applies `add_question_difficulty`, seed runs, "Seed complete."

- [ ] **Step 5: Verify counts in the DB**

Run: `npx tsx scripts/check-counts.ts`
Expected: `questions` ≈ 93 (33 warmup + ~60 hard), `concepts: 22`.

- [ ] **Step 6: Smoke-test the no-repeat path** — create `scripts/_smoke-fetch.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";
import os from "node:os";
const adapter = new PrismaLibSql({ url: `file:${path.join(os.homedir(), ".cca-f-tutor", "cca-f.db")}` });
const prisma = new PrismaClient({ adapter });
async function main() {
  const hard = await prisma.question.count({ where: { difficulty: "hard" } });
  const warm = await prisma.question.count({ where: { difficulty: "warmup" } });
  const byDomainHard = await prisma.question.groupBy({ by: ["domain"], where: { difficulty: "hard" }, _count: true });
  console.log({ hard, warm, byDomainHard });
}
main().catch(console.error).finally(() => prisma.$disconnect());
```

Run: `npx tsx scripts/_smoke-fetch.ts`
Expected: `hard` ≥ 60, `warm` = 33, each domain present. Then delete it: `rm scripts/_smoke-fetch.ts`.

- [ ] **Step 7: Commit**

```bash
git add scripts/validate-content.ts
git commit -m "chore(validator): gate hard-tier bank at 60+ with per-domain minimums"
```

---

## Self-Review (completed at plan time)

- **Spec coverage:** difficulty tier + migration → Task 1; validator difficulty awareness → Task 2 (+ size gate Task 10); no-repeat-in-mock + difficulty filter → Task 3; above-real-exam multi-constraint bank by domain weight → Tasks 4–8 (16/12/12/11/9 = 60, matching mock weights); hardened generation rubric → Task 9; readiness recalibrated to >900 → Task 9 Step 3. All requirements mapped.
- **Placeholder scan:** Tasks 4–8 are content-authoring; the quality bar + worked example + exact per-concept counts are the spec (a plan cannot pre-write 60 unique questions without being the implementation). Every mechanical step (schema, migration, handler, validator) has complete code.
- **Type consistency:** `difficulty?: "warmup" | "hard"` is identical across QuestionSeed (Task 1), seed writer (Task 1), validator (Tasks 2, 10), and tool schema (Task 3). `fetch_question` params `{conceptSlug, difficulty?, noRepeat?}` match between handler (Task 3 Step 1) and schema (Task 3 Step 2). Hard per-domain counts (16/12/12/11/9) are consistent between Tasks 4–8, the Task 10 gate, and the Task 9 mock weights.
- **Correction applied:** Task 8 originally double-counted `multi-agent-orchestration` under Context; fixed to `context-window-mgmt` ×4 + `error-propagation-provenance` ×5 (both `domain: "Context"`), total 9.
