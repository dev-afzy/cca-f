# CCA-F v1.0 Alignment Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** Close the two content defects found by diffing our app against the **v1.0 (July 2026, CCAR-F)** exam guide: (A) the missing Agent SDK hooks objective (Task Statement 1.5), and (B) the bank modelling the wrong item format (multiple-response items are real).

**Architecture:** Additive. (A) is content-only — one new concept + curriculum + questions. (B) widens `Question`/`ExamAnswer` with a JSON key-set alongside the existing single-key columns, routes all grading through one shared helper, and adds checkbox mode to the exam UI. Single-answer stays the 1-element case, so nothing existing changes behaviour.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + libsql SQLite.

## Global Constraints
- **Node ≥ 22 + env:** `export PATH="/Users/afeesudheenp/.nvm/versions/node/v22.17.1/bin:$PATH" && set -a && . ./.env && set +a` then the command. Verify `node -v` = v22.
- **`npm run validate:content` MUST pass at the end of every task.** Its gates: (1) every question → existing concept; (2) question domain == concept domain; (4) `HOUR_TOPICS` == curriculum `### Hour N — Title` headings; (5) every concept name appears in `state-template.md`; (9) hard-tier ≥120 total with per-domain minima Agentic 32 / Claude Code 24 / Prompts 24 / Tool & MCP 22 / Context 18 (these are **floors** — adding is safe).
- **Migrations are hand-authored + `prisma migrate deploy`** (never `migrate dev`). Back up `~/.cca-f-tutor/cca-f.db` first.
- **Do not change any Hour title** (keeps validator #4 green without touching `hour-topics.ts`).
- Money/format values come from the v1.0 guide verbatim — do not invent exam facts.
- Reports → `.superpowers/sdd/v1-task-N-report.md`.

---

## Feature A — Agent SDK hooks (Task Statement 1.5)

### Task 1: New concept + curriculum + questions (atomic — validator must stay green)

**Files:** `src/lib/concept-seed.ts` · `.claude/skills/state-template.md` · `.claude/skills/curriculum.md` · `src/lib/question-seed.ts` · `.claude/skills/question-bank.md`

This is one task because validator #1 (concept needs ≥2 questions) and #5 (state-template lists every concept) fail if the parts land separately.

**The authoritative objective — verbatim from the v1.0 guide, do not paraphrase away the specifics:**
> **Task Statement 1.5: Apply Agent SDK hooks for tool call interception and data normalization**
> Knowledge of: Hook patterns (e.g. `PostToolUse`) that intercept tool results for transformation before the model processes them · Hook patterns that intercept outgoing tool calls to enforce compliance rules (e.g. blocking refunds above a threshold) · The distinction between using hooks for deterministic guarantees versus relying on prompt instructions for probabilistic compliance
> Skills in: Implementing `PostToolUse` hooks to **normalize heterogeneous data formats (Unix timestamps, ISO 8601, numeric status codes)** from different MCP tools before the agent processes them · Implementing tool call interception hooks that **block policy-violating actions (e.g. refunds exceeding $500) and redirect to alternative workflows** (e.g. human escalation) · Choosing hooks over prompt-based enforcement when business rules require guaranteed compliance

We already teach the enforcement half (Hour 17: tool gating, enforcement-vs-guidance, proportionality). **The gap is the data-normalization half.**

- [ ] **Step 1: Add the concept** to `src/lib/concept-seed.ts`, immediately after `guardrails` (keep `sortOrder` contiguous — renumber following entries if the file uses sequential values):
```ts
{ slug: "agent-sdk-hooks", name: "Agent SDK Hooks & Data Normalization", week: 3, domain: "Agentic", sortOrder: <after guardrails> },
```
Domain **must** be `Agentic` (TS 1.5 is Domain 1) — validator #2 requires every question tagged `Agentic` too.

- [ ] **Step 2: Add the name to `.claude/skills/state-template.md`** under the Week 3 group of `[Concept Mastery]`, exactly `Agent SDK Hooks & Data Normalization` (validator #5 does a substring match on the concept `name`).

- [ ] **Step 3: Extend Hour 17 in `.claude/skills/curriculum.md`.** Keep the heading `### Hour 17 — Guardrails: Multi-Layer Defense` byte-identical. Add to **Topics** (after the existing `PreToolUse`/`PostToolUse` bullet):
  - `PostToolUse` as a **data-normalization layer**, not only a gate: transform tool results *before the model sees them*.
  - Heterogeneous formats across MCP tools — Unix epoch vs ISO 8601 timestamps, numeric status codes vs strings — normalized in one hook instead of teaching the model to handle every variant.
  - Tool-call interception that **blocks a policy-violating action and redirects** (refund > $500 → human escalation), rather than merely refusing.
  - Hooks give **deterministic** guarantees; prompt instructions give **probabilistic** compliance — say which the business rule requires.
  Add to **Friction zones:** assuming a hook can only block, never transform; normalizing in the prompt ("the dates may be in different formats") instead of in a `PostToolUse` hook.
  Add to **Analogy seed:** a `PostToolUse` hook is the translator who converts every supplier's invoice into one currency before it reaches the accountant — the accountant never learns six formats.

- [ ] **Step 4: Name the SDK where we already teach it** — a terminology pass, because the guide names *"Claude Agent SDK"* as one of four core technologies and frames 3 of 6 scenarios with *"using the Claude Agent SDK"*, a phrase currently absent from our curriculum. Add a short parenthetical naming the SDK to the **Topics** of Hours 5, 12, 20, 21 where the underlying feature is already taught (`stop_reason` handling, agentic loops, `AgentDefinition` / `Task`-tool subagent spawning / `allowedTools`, session `--resume`/`fork_session`). Do **not** restructure those hours — one clause each. Also add a line to Hour 1's exam-map topics: the exam tests four core technologies — **Claude Code, the Claude Agent SDK, the Claude API, and MCP**.

- [ ] **Step 5: Author 6 questions** in `src/lib/question-seed.ts`, all `conceptSlug: "agent-sdk-hooks"`, `domain: "Agentic"`, slugs prefixed `agent-sdk-hooks-`. **4 with `difficulty: "hard"`, 2 warm-up (omit the field).** Follow the existing house rubric in `.claude/skills/question-bank.md`: production scenario, ≥2 quantified facts + ≥1 hard constraint, three genuinely defensible distractors, `distractorReasons` naming the violated constraint and **never referencing option letters** (they are shuffled). Cover: (a) heterogeneous timestamp/status-code normalization via `PostToolUse`; (b) hook-vs-prompt for a must-never-break rule; (c) intercept-and-redirect on a $500 refund threshold; (d) where in the lifecycle the hook fires (`PreToolUse` vs `PostToolUse`); (e) the over-engineering counterweight — a case where explicit criteria beat a hook (proportionality); (f) normalizing in the hook vs instructing the model.

- [ ] **Step 6: Add an exemplar** to `.claude/skills/question-bank.md`'s "Exemplars by Concept" list: `Agent SDK Hooks & Data Normalization`.

- [ ] **Step 7: Verify** — `npm run validate:content` → passes and now reports **23 concepts, 159 questions**; hard total **124**; Agentic hard ≥ 36. Then `npm run build` → green.

- [ ] **Step 8: Commit** `git add src/lib/concept-seed.ts src/lib/question-seed.ts .claude/skills && git commit -m "feat(curriculum): Agent SDK hooks + data normalization (v1.0 Task Statement 1.5)"`

### Task 2: Reseed + mastery backfill (operational — controller runs this)

`getMasterySnapshot` reads `ConceptMastery` rows joined to `Concept`, so a newly seeded concept is **invisible** to an existing student until a mastery row exists.

- [ ] **Step 1:** Back up: `cp ~/.cca-f-tutor/cca-f.db ~/.cca-f-tutor/cca-f.db.bak-agentsdk-$(date +%Y%m%d-%H%M%S)`
- [ ] **Step 2:** `npx prisma migrate deploy` (no-op) then `npx tsx prisma/seed.ts` to upsert the new concept + questions.
- [ ] **Step 3:** Backfill a `ConceptMastery` row at `mastery: 0` for **every existing student × every concept lacking one** (idempotent `createMany` over the missing pairs). Verify the owner account then shows **23** concepts with the new one at 0%.
- [ ] **Step 4:** `npm run validate:content && npm run build` → both green.

---

## Feature B — Multiple-response item format

**Why:** v1.0 §3 states verbatim: *"**Item format** — Multiple-choice and multiple-response items; each item states how many responses to select."* Our bank is 100% single-answer, so both mocks train the wrong format.

**Design:** additive columns; single-answer remains the 1-element case.
- `Question.responseCount Int @default(1)` — how many to select.
- `Question.correctKeys String?` — JSON array of **canonical** letters, e.g. `["A","C"]`. `NULL` ⇒ fall back to `correctKey`.
- `ExamAnswer.chosenKeys String?` — JSON array of the student's **shuffled-position** letters. `NULL` ⇒ fall back to `chosenKey`.
- One accessor pair used everywhere: `correctKeySet(question)` and `chosenKeySet(answer)`.

### Task 3: Schema + migration
**Files:** `prisma/schema.prisma` · `prisma/migrations/20260820120000_add_multi_response/migration.sql`
- [ ] Add the three columns above. Hand-author the SQL (`ALTER TABLE "Question" ADD COLUMN "responseCount" INTEGER NOT NULL DEFAULT 1;` etc.), matching the SQLite style of `20260628140000_add_billing/migration.sql`. **Do not run migrate deploy** (Task 7 does, with a backup). Verify `npx prisma generate && npm run build` green.
- [ ] Commit `feat(exam): schema for multiple-response items`.

### Task 4: Shared grading helper + validator check
**Files:** `src/lib/exam/score.ts` · `src/lib/tutor/tool-handlers.ts` · `scripts/validate-content.ts`
- [ ] In `score.ts` export `correctKeySet(q): string[]` (parse `correctKeys` else `[correctKey]`) and rewrite `gradeAnswer` to: map **each** chosen shuffled key → canonical via the stored permutation, then compare as an **exact set** (sorted equality — no partial credit; the guide gives no evidence of partial scoring). Preserve the existing single-answer signature as a thin wrapper so current callers keep working.
- [ ] Route the tutor's `record_attempt` grading in `tool-handlers.ts` through the same helper so a multi-response question can never be mis-graded in a checkpoint.
- [ ] Add validator check #10: for every question, `responseCount >= 1`; if `responseCount > 1` then `correctKeys` must be set and `correctKeys.length === responseCount`; every key must be one of the option keys.
- [ ] `npm run validate:content && npm run build` green. Commit `feat(exam): exact-set grading for multiple-response items`.

### Task 5: Exam UI + answer route
**Files:** `src/app/exam/[attemptId]/ExamRunner.tsx` · `src/app/api/exam/answer/route.ts` · `src/app/api/exam/submit/route.ts`
- [ ] `answer` route accepts `chosenKeys: string[]` (keep `chosenKey` accepted for back-compat) and persists `chosenKeys` JSON.
- [ ] `ExamRunner`: when `responseCount > 1` render **checkboxes** instead of radios, show the guide's own wording — *"Select N"* — and only enable Next/submit once **exactly N** are selected. Single-answer behaviour unchanged.
- [ ] `submit` grades via the shared helper. `npm run build` green. Commit `feat(exam): multiple-response UI + answer persistence`.

### Task 6: Author multiple-response questions + rubric
**Files:** `src/lib/question-seed.ts` · `.claude/skills/question-bank.md`
- [ ] Author **10** multiple-response questions (`responseCount: 2` or `3`, `correctKeys` set), spread across all five domains so both mocks can surface the format: Agentic 3, Claude Code 2, Prompts 2, Tool & MCP 2, Context 1. All `difficulty: "hard"`. Stems must state the selection count in the guide's style. `distractorReasons` must explain why each **non**-selected option fails.
- [ ] Add a "Multiple-response items" section to the authoring rubric in `question-bank.md`.
- [ ] `npm run validate:content` (new check #10 must pass) + `npm run build`. Commit `feat(question-bank): multiple-response items across all domains`.

### Task 7: Migrate + e2e verify (operational — controller runs this)
- [ ] Back up the DB; `npx prisma migrate deploy`; reseed.
- [ ] Verify: a multi-response question round-trips — start a mock, answer a `responseCount: 2` item with both correct keys → `correct: true`; with one correct + one wrong → `correct: false`; with only one of two → `correct: false`.
- [ ] Confirm existing single-answer questions still grade identically (regression check on a known item).
- [ ] `npm run validate:content && npm run build` green; `git status` clean.
- [ ] Update `docs/BACKLOG.md`: mark item #2 done.

---

## Self-Review
- **Coverage:** TS 1.5 → Task 1; invisibility of new concepts → Task 2; item format → Tasks 3–7.
- **Validator coherence:** Task 1 is atomic so #1/#2/#5 never break mid-flight; hard-tier floors only ever increase.
- **Back-compat:** every new column is nullable/defaulted and single-answer is the 1-element case, so the 153 existing questions and both mocks are unaffected.
- **Grounding:** all exam facts quoted from the v1.0 guide; no invented mechanics.
- **Deferred:** curriculum v0.1→v1.0 text refresh and the exam-mechanics additions remain backlog item #3.
