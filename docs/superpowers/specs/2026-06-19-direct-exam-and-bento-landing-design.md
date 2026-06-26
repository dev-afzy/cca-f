# Direct Mock Exam + Bento Landing — Design Spec

**Date:** 2026-06-19
**Status:** Approved direction, pending spec review → writing-plans

## Goal

Let the user take a full, exam-realistic mock **directly from the app** — timed, self-graded, independent of the tutor chat, and replayable — reached from a redesigned **bento-grid landing page** that surfaces readiness and exam trend at a glance.

## Why two coupled deliverables

The landing page's richer tiles (readiness gauge, exam-trend sparkline) are fed by exam results, so the bento landing and the `/exam` feature are designed and built together. They are one feature with two surfaces.

## Decisions (locked in brainstorming)

- **Delivery:** standalone `/exam` page, deterministic — pulls hard questions itself and grades from the stored `correctKey`. **No tutor LLM** in the exam loop; zero API cost to deliver or grade.
- **Timing:** timed, **120 minutes**, visible countdown anchored to a server timestamp; auto-submits at zero.
- **Results:** full report — overall score + pass/fail verdict, per-domain breakdown, AND per-question review (your answer vs correct + distractor explanation).
- **Persistence:** exam attempts are stored in **their own tables, independent** of the tutor's `Session`/`QuestionAttempt`/`QuestionFetch`. Exams do **not** nudge concept mastery and do **not** consume the no-repeat pool → fully **replayable**. Results are recorded so the ledger/landing can show trajectory.
- **Landing:** **Bento grid** (Direction E).

## Architecture

### Data model (new tables — Prisma migration)

```
model ExamAttempt {
  id            Int       @id @default(autoincrement())
  studentId     String
  startedAt     DateTime  @default(now())
  submittedAt   DateTime?
  status        String    @default("in_progress")  // in_progress | submitted | expired
  totalQuestions Int
  correctCount  Int       @default(0)
  perDomain     String    @default("{}")            // JSON: { "<domain>": { correct, total } }
  durationLimitSec Int    @default(7200)            // 120 min
  student       Student   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  answers       ExamAnswer[]
  @@index([studentId, startedAt])
}

model ExamAnswer {
  id          Int      @id @default(autoincrement())
  attemptId   Int
  questionId  Int
  orderIndex  Int                                   // presentation order in this attempt
  permutation String                                // JSON shuffled→canonical, like QuestionFetch
  chosenKey   String?                               // shuffled letter the student picked (null = unanswered)
  correct     Boolean  @default(false)              // set at grade time
  attempt     ExamAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  question    Question    @relation(fields: [questionId], references: [id], onDelete: Cascade)
  @@index([attemptId, orderIndex])
}
```

`Student` gains `examAttempts ExamAttempt[]`; `Question` gains `examAnswers ExamAnswer[]`.

### Question selection (`src/lib/exam/select.ts`)

- Read all `difficulty: "hard"` questions, group by `domain`, take to the exam weights **Agentic 16 / Claude Code 12 / Prompts 12 / Tool & MCP 11 / Context 9 = 60**. If a domain has more than needed, sample randomly; today it matches exactly. (`Math.random` is fine here — runtime, not a workflow script.)
- Shuffle the combined 60 into a presentation order; shuffle each question's options via the existing `shuffleOptions()` and persist the permutation per `ExamAnswer`. Re-shuffled every attempt → replayable.

### Scoring & readiness (`src/lib/exam/score.ts`)

- `overall% = correctCount / totalQuestions`. `perDomain[d] = correct/total` from `ExamAnswer` joined to `Question.domain`.
- **Verdict (reuses the hardened bar):** `ready` if `overall ≥ 90%` AND every domain `≥ 75%`; otherwise "keep training." Show the real-exam context (scaled 100–1000, pass 720) as informational text, not as a computed scaled score (the curve is unknown).
- Unanswered = wrong (no guessing penalty; the UI nudges answering all).
- `readiness` helper (shared with the landing): from the latest **submitted** attempt → `{ overallPct, perDomain, weakestDomain, verdict }`; `null` if no submitted attempt.

### API routes (App Router, `runtime = "nodejs"`)

- **`POST /api/exam/start`** → create `ExamAttempt` + `ExamAnswer` rows (chosenKey null), return `{ attemptId, startedAt, durationLimitSec, questions: [{ questionId, orderIndex, stem, options }] }`. **Never returns `correctKey`/`distractorReasons`.**
- **`POST /api/exam/answer`** `{ attemptId, questionId, chosenKey }` → upsert `ExamAnswer.chosenKey` (autosave, so refresh/crash preserves answers). Rejects if attempt already submitted.
- **`POST /api/exam/submit`** `{ attemptId }` → grade every `ExamAnswer` via `grade()` + its permutation, set `correct`, compute `correctCount`+`perDomain`, set `submittedAt`+`status`, return the full report + review. If `now − startedAt > durationLimitSec`, grade whatever is saved and mark `expired`.

### UI / routes

- **`/` (home) → Bento grid** (server component). Reads `currentHour`, days-left, mastery snapshot, and the latest `ExamAttempt` (for readiness + trend). Tiles:
  - **Hero** — brand + primary **"Take mock exam"** → `/exam`.
  - **Readiness gauge** — last overall % ring + verdict; empty state ("Take your first mock") when no attempts.
  - **Continue tutoring** — → `/chat`, shows next hour.
  - **Exam trend** — sparkline of recent overall %s; empty state when <2 attempts.
  - **Progress & history** — → `/ledger`.
  - Built with the **frontend-design** skill at implementation for the polish.
- **`/exam`** — start screen: rules (60q · 120m · timed · no help), last attempt summary, **Start** button → `POST /api/exam/start` → redirect to `/exam/[attemptId]`.
- **`/exam/[attemptId]`** — client runner: one question at a time, A–D selection, prev/next, a question navigator (answered / unanswered / marked-for-review), a **server-anchored countdown** (remaining = `durationLimitSec − (now − startedAt)`; refresh-safe), per-answer autosave, and **Submit**. On submit or expiry → result page. Re-entering an in-progress attempt rehydrates saved answers + remaining time.
- **`/exam/[attemptId]/result`** — server component: overall score + verdict, per-domain bars, and per-question review (stem, your answer, correct answer, distractor explanation), reusing the permutation to map letters to what was shown.

### Ledger integration

`renderLedger` gains an **"Exam History"** section: a table of submitted attempts (date · overall % · weakest domain), read from `ExamAttempt`. Independent of the mastery section.

## Component boundaries

- `src/lib/exam/select.ts` — pick + shuffle the 60 (pure, testable given a question list).
- `src/lib/exam/score.ts` — grade + per-domain + verdict + readiness (pure).
- `src/app/api/exam/{start,answer,submit}/route.ts` — thin HTTP wrappers over the libs + Prisma.
- `src/app/exam/*` — start screen, runner (client), result (server).
- `src/app/page.tsx` — bento landing (server) + small client bits (theme already exists).
- Each lib answers: what it does, its inputs/outputs, no hidden coupling to the tutor flow.

## Answer-leak prevention (security)

The keyed answers and distractor reasons live only server-side; `start` and `answer` never serialize them to the client. They appear only in the `submit`/result response, after the attempt is closed.

## Reuse

`grade()`, `shuffleOptions()` + permutation helpers (`parsePermutation`/`invertPermutation`/`remapByPermutation`/`translateToCanonical`), `DOMAIN_LABELS`, the hard question bank, and the `frontend-design` skill (implementation only).

## Out of scope (YAGNI)

- No proctoring/webcam/lockdown. No real scaled-score curve (raw % + context only). No LLM-generated questions on retake (contradicts the standalone/no-LLM decision; the 60-question bank is re-shuffled instead). No multi-user/accounts (single `default` student, as today). No partial-credit.

## Verification (no test framework in repo)

- `npm run build` type-clean; `npm run validate:content` still green.
- A runtime smoke: `start → answer (a few) → submit` returns a graded report with correct per-domain totals summing to the answered/served counts; `/`, `/exam`, `/exam/[id]`, `/exam/[id]/result` all render.
- DB-safety: confirm an exam run writes only `ExamAttempt`/`ExamAnswer` and leaves `ConceptMastery`/`QuestionAttempt`/`QuestionFetch` untouched (the replayable/independent guarantee). Back up `~/.cca-f-tutor/cca-f.db` before any `db:setup`.

## Open defaults (vetoable at spec review)

1. **Runner = one question at a time** with a navigator (most exam-like), not a single long scrollable page.
2. **Retake = the same 60 hard questions, re-shuffled** each attempt (deterministic, replayable). If the hard bank later exceeds 60, sample to the weights for cross-attempt variety.
3. **Autosave per answer** (resilience) rather than bulk-only submit.
