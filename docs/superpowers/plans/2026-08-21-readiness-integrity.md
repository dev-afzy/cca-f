# Readiness Integrity Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** Make the app's "you are ready" signal evidence-backed rather than impressionistic, and give it
enough question depth to stay honest for a struggling student.

**Why (the diagnosis this came from):** The author studied the full 23 hours, was shown **90% mean
mastery**, sat the real exam and failed by 18 points. The data says why: **34** graded answers total
(design implies ~220), **zero** completed mocks, and **13 of 23 hours with no graded question at all**.
Mastery is asserted by the tutor model via `update_mastery`/`nudgeMastery`, not earned. `advance_hour`
has no gate. The app's own Hour 17 lesson — *hooks give deterministic guarantees, prompt instructions
give probabilistic compliance* — is exactly the bug: testing the student is a prompt instruction.

**Architecture:** Four independent changes. Two are deterministic gates in existing tool handlers, one
is a readiness-verdict change, one is content growth. All additive; no schema change except an index if
profiling needs it.

## Global Constraints
- **Node ≥ 22 + env:** `export PATH="/Users/afeesudheenp/.nvm/versions/node/v22.17.1/bin:$PATH" && set -a && . ./.env && set +a`.
- `npm run validate:content`, `npm run test:grading` and `npm run build` must pass at the end of every task.
- Gates must return **structured, actionable errors** the tutor model can recover from — never a bare throw.
- Do not weaken any existing validator check. Hard-tier per-domain floors are minimums; raising them is safe.
- Never reduce a student's existing mastery or progress as a side effect.

---

### Task 1: Gate `advance_hour` on recorded checkpoints  ← start here

**Files:** `src/lib/tutor/tool-handlers.ts` (the `advance_hour` case), `src/lib/tutor/tools.ts` (tool description), `.claude/skills/SKILL.md`

The hour must not advance until the student has actually been tested.

- [ ] **Step 1:** In the `advance_hour` handler, before incrementing, count graded `QuestionAttempt`
  rows for `(studentId, hour = student.currentHour)`. Require:
  - normal hours: **≥3**
  - mini-mock hours **7 and 14**: **≥10**
  - mock hours **22 and 23**: at least one `ExamAttempt` for this student with `status` in
    (`submitted`,`expired`) whose `startedAt` is after the hour began — the 60-question mock is the
    checkpoint for those hours.
- [ ] **Step 2:** When the requirement is unmet, return `isError: false` with a structured payload the
  model must act on — `{ advanced: false, reason: "checkpoints_required", hour, have, need, message }`
  where `message` instructs it to run the remaining checkpoints with `fetch_question` +
  `record_attempt` before trying again. Do **not** throw; the tutor should recover in-conversation.
- [ ] **Step 3:** Update the `advance_hour` tool description in `tools.ts` to state the precondition, so
  the model plans for it rather than discovering it.
- [ ] **Step 4:** Add one line to `SKILL.md`'s operating principles: the hour advances only on recorded
  evidence, and a checkpoint the student got wrong still counts as evidence.
- [ ] **Step 5: Verify** with a tsx harness against a scratch student: 0 checkpoints → refused with
  `need: 3`; 2 → refused; 3 → advances; hour 7 with 3 → refused with `need: 10`. Delete the harness.
- [ ] **Step 6: Commit** `feat(tutor): gate advance_hour on recorded checkpoints`

---

### Task 2: Readiness verdict requires completed mocks

**Files:** `src/lib/exam/score.ts`, `src/app/page.tsx`, `src/app/chat/MasterySidebar.tsx`, `src/app/ledger/page.tsx`

Today `verdict()` returns ready on a single mock's percentages, and mastery (model-asserted) is what the
student sees day to day. Neither is evidence of exam readiness.

- [ ] **Step 1:** Add `readinessFromAttempts(attempts)` to `score.ts`: ready **only** when ≥2 attempts
  with `status` in (`submitted`,`expired`) each satisfy ≥`READY_OVERALL` overall and no domain below
  `READY_DOMAIN`. Fewer than 2 qualifying attempts ⇒ a distinct third state, **not measured**.
- [ ] **Step 2:** Make the three states explicit in the return type: `"not_measured" | "not_ready" | "ready"`,
  with copy — not measured: *"Take two full mocks to measure readiness"*; not ready: *"Keep training"*;
  ready: *"Ready to sit the real exam"*. Keep `Verdict` back-compatible for existing callers.
- [ ] **Step 3:** Surface the state wherever readiness is shown (landing gauge, sidebar, ledger). The
  gauge must not read "Almost ready" off a mastery average — when unmeasured it says so.
- [ ] **Step 4:** Label the mastery panel as self-reported/tutor-assessed progress, distinct from
  measured readiness, so a 90% mastery reading can never be mistaken for a go signal.
- [ ] **Step 5: Verify** `npm run test:grading` plus a tsx harness: 0 attempts ⇒ not_measured;
  1 passing attempt ⇒ not_measured; 2 passing ⇒ ready; 2 attempts where one has a 70% domain ⇒ not_ready.
- [ ] **Step 6: Commit** `feat(exam): readiness requires two completed mocks, not mastery`

---

### Task 3: Per-concept question floor

**Files:** `scripts/validate-content.ts`, `src/lib/question-seed.ts`

Task 1's 3-per-hour gate needs ≥3 questions the tutor can actually serve. `fetch_question` filters to
`responseCount: 1`, so multiple-response items do not count toward this floor.

- [ ] **Step 1:** Add validator check #11: every concept must have **≥3** questions with
  `responseCount = 1`. Report the shortfall per concept.
- [ ] **Step 2:** Author the missing items — currently `tool-calling-mechanics` (2) and
  `agent-pattern-eval` (2) — to the house rubric in `question-bank.md`, matching each concept's domain.
- [ ] **Step 3: Verify** validator passes; counts rise accordingly; build green.
- [ ] **Step 4: Commit** `feat(question-bank): per-concept floor of 3 tutor-servable questions`

---

### Task 4: Grow the hard bank to ~240

**Files:** `src/lib/question-seed.ts`, `scripts/validate-content.ts`, `.claude/skills/question-bank.md`

Two 60-question mocks consume 120 of 134 hard items (89%), so a student who fails twice re-tests on
seen questions and their score rises by recall. 240 supports four non-overlapping mocks.

- [ ] **Step 1:** Author ~106 additional hard questions, distributed to the mock weights so each domain
  reaches 4× its per-mock quota: **Agentic 64 · Claude Code 48 · Prompts 48 · Tool & MCP 44 · Context 36**.
  Work in per-domain batches; each batch gets an avoid-list of existing slugs in that domain to prevent
  near-duplicates (this has bitten before — a prior batch reskinned five existing items).
- [ ] **Step 2:** Weight new items toward the objectives the coverage grade marks thin, not just the
  easy-to-write ones.
- [ ] **Step 3:** Raise the validator's `HARD_DOMAIN_MIN` to the new floors and the hard-total gate to 240.
- [ ] **Step 4: Verify** validator passes at the new floors; two consecutive mock draws share no items;
  `npm run test:grading` and build green.
- [ ] **Step 5: Commit** `feat(question-bank): grow hard tier to 240 for four non-overlapping mocks`

---

### Task 5: Close the thin objectives

**Files:** `.claude/skills/curriculum.md`, `src/lib/concept-seed.ts`, `.claude/skills/state-template.md`, `src/lib/question-seed.ts`

The coverage grade identifies objectives with no dedicated concept — at minimum **2.5** (selecting among
built-in tools Read/Write/Edit/Bash/Grep/Glob) and **5.4** (context management in large-codebase
exploration). Both are currently incidental mentions inside other hours.

- [ ] **Step 1:** For each thin objective, either add a concept (with `state-template.md` entry and
  ≥3 questions, atomically, as validator #1/#5 require) or deepen the owning hour so the objective is
  taught explicitly rather than in passing. Prefer deepening where an existing concept clearly owns it.
- [ ] **Step 2:** Re-run the coverage grade and record the before/after in `docs/COVERAGE.md`.
- [ ] **Step 3: Commit** `feat(curriculum): close thin exam objectives (2.5, 5.4)`

---

## Explicitly out of scope
- Publishing any pass-rate figure. There are zero validated mock-to-exam data points; the claim is
  coverage plus the readiness gate. Revisit only with real reported outcomes at meaningful n.
- Options beyond A–D (needed for realistic select-3 items) — tracked in `docs/BACKLOG.md`.
- Letting the tutor serve multiple-response checkpoints — tracked in `docs/BACKLOG.md` (2a).
