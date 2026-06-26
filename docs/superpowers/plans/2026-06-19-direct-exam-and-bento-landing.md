# Direct Mock Exam + Bento Landing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone, timed (120 min), self-graded, replayable mock exam at `/exam`, reachable from a redesigned bento-grid landing page, with results recorded in independent tables and surfaced in the ledger.

**Architecture:** Two new Prisma tables (`ExamAttempt`, `ExamAnswer`) hold exam state, fully separate from the tutor's `Session`/`QuestionAttempt`/`QuestionFetch` — so exams never nudge mastery or consume the no-repeat pool. Pure libs select/shuffle 60 hard questions (`src/lib/exam/select.ts`) and grade/score them (`src/lib/exam/score.ts`). Thin API routes (`/api/exam/{start,answer,submit}`) wrap the libs + Prisma; the keyed answers are never sent to the client. The runner and result pages rebuild the shuffled presentation deterministically from the stored permutation, so `start` returns only `{attemptId}`. The bento landing reads the latest attempt for the readiness gauge and trend.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Prisma 7 + libsql (SQLite), Tailwind v4. No test framework — each task verifies via a throwaway `tsx` script and/or `npm run build` + a runtime curl, then deletes the throwaway.

## Global Constraints

- Exam tables are **independent**: exam flows write ONLY `ExamAttempt`/`ExamAnswer`. They must NOT write `QuestionAttempt`, `QuestionFetch`, or call `nudgeMastery`.
- **Answer-leak prevention:** `correctKey` and `distractorReasons` are NEVER serialized to the client by `/api/exam/start` or `/api/exam/answer`. They appear only after submit (on the result page, server-rendered).
- Exam domain weights are exactly **Agentic 16 / Claude Code 12 / Prompts 12 / Tool & MCP 11 / Context 9 = 60**, drawn from `difficulty: "hard"` questions only.
- Readiness verdict (reused everywhere): **ready** iff overall ≥ 90% AND every domain ≥ 75%; else "keep training".
- Duration limit is **7200 seconds** (120 min); the countdown is anchored to the server `startedAt` (refresh-safe); unanswered = wrong (no guessing penalty).
- Single student: id `"default"` (as the rest of the app).
- No test framework — do NOT add one. Verify with `tsx` throwaways + `npm run build` + `npm run validate:content` (must stay green) + curl.
- DB path is `~/.cca-f-tutor/cca-f.db`; back it up before any `db:setup` (live study sprint). Adding tables is additive — existing rows are untouched.
- `Math.random()` is allowed here (runtime code, not a workflow script).
- Existing reusable code: `shuffleOptions`, `parsePermutation`, `invertPermutation`, `remapByPermutation`, `translateToCanonical`, `isOptionKey`, `KEYS`, `type Permutation`, `type CanonicalOptions`, `type OptionKey` from `@/lib/tutor/shuffle`; `grade` from `@/lib/tutor/grade`; `DOMAIN_LABELS` from `@/lib/domains`; `prisma` from `@/lib/prisma`.

---

### Task 1: Schema + migration for ExamAttempt / ExamAnswer

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260619120000_add_exam_tables/migration.sql`

**Interfaces:**
- Produces: Prisma models `ExamAttempt` (id, studentId, startedAt, submittedAt?, status, totalQuestions, correctCount, perDomain, durationLimitSec) and `ExamAnswer` (id, attemptId, questionId, orderIndex, permutation, chosenKey?, correct); relations `Student.examAttempts`, `Question.examAnswers`.

- [ ] **Step 1: Add the models + relations to schema.prisma**

In `prisma/schema.prisma`, add to `model Student` (after the existing `sprintNotes` relation line):

```prisma
  examAttempts      ExamAttempt[]
```

Add to `model Question` (after the existing `fetches` relation line):

```prisma
  examAnswers       ExamAnswer[]
```

Append these two models at the end of the file:

```prisma
model ExamAttempt {
  id               Int       @id @default(autoincrement())
  studentId        String
  startedAt        DateTime  @default(now())
  submittedAt      DateTime?
  status           String    @default("in_progress")
  totalQuestions   Int
  correctCount     Int       @default(0)
  perDomain        String    @default("{}")
  durationLimitSec Int       @default(7200)
  student          Student   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  answers          ExamAnswer[]
  @@index([studentId, startedAt])
}

model ExamAnswer {
  id          Int         @id @default(autoincrement())
  attemptId   Int
  questionId  Int
  orderIndex  Int
  permutation String
  chosenKey   String?
  correct     Boolean     @default(false)
  attempt     ExamAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  question    Question    @relation(fields: [questionId], references: [id], onDelete: Cascade)
  @@index([attemptId, orderIndex])
}
```

- [ ] **Step 2: Create the migration SQL**

Create `prisma/migrations/20260619120000_add_exam_tables/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "ExamAttempt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "totalQuestions" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "perDomain" TEXT NOT NULL DEFAULT '{}',
    "durationLimitSec" INTEGER NOT NULL DEFAULT 7200,
    CONSTRAINT "ExamAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExamAttempt_studentId_startedAt_idx" ON "ExamAttempt"("studentId", "startedAt");

-- CreateTable
CREATE TABLE "ExamAnswer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "attemptId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "permutation" TEXT NOT NULL,
    "chosenKey" TEXT,
    "correct" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ExamAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExamAnswer_attemptId_orderIndex_idx" ON "ExamAnswer"("attemptId", "orderIndex");
```

- [ ] **Step 3: Regenerate client + typecheck**

Run: `npx prisma generate` → Expected: "Generated Prisma Client".
Run: `npm run build` → Expected: no type errors (new models available on `prisma`).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260619120000_add_exam_tables
git commit -m "feat(schema): ExamAttempt + ExamAnswer tables (independent of tutor data)"
```

---

### Task 2: Exam question selection lib

**Files:**
- Create: `src/lib/exam/select.ts`

**Interfaces:**
- Consumes: `shuffleOptions`, types from `@/lib/tutor/shuffle`.
- Produces: `EXAM_DOMAIN_WEIGHTS`, `EXAM_TOTAL = 60`, `type SourceQuestion = { id: number; domain: string; stem: string; options: string }`, `type SelectedQuestion = { questionId: number; orderIndex: number; stem: string; shuffled: CanonicalOptions; permutation: Permutation }`, and `selectExamQuestions(pool: SourceQuestion[]): SelectedQuestion[]`.

- [ ] **Step 1: Write select.ts**

Create `src/lib/exam/select.ts`:

```typescript
import "server-only";
import {
  shuffleOptions,
  type CanonicalOptions,
  type Permutation,
} from "@/lib/tutor/shuffle";

export const EXAM_DOMAIN_WEIGHTS: Record<string, number> = {
  Agentic: 16,
  "Claude Code": 12,
  Prompts: 12,
  "Tool & MCP": 11,
  Context: 9,
};
export const EXAM_TOTAL = 60;

export type SourceQuestion = {
  id: number;
  domain: string;
  stem: string;
  options: string; // JSON string {A,B,C,D}
};

export type SelectedQuestion = {
  questionId: number;
  orderIndex: number;
  stem: string;
  shuffled: CanonicalOptions;
  permutation: Permutation;
};

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Pick EXAM_TOTAL questions to the domain weights from a pool of hard
 * questions, shuffle the overall order, and shuffle each question's options
 * (persisting the permutation). Re-shuffled on every call → replayable.
 * Throws if a domain can't meet its weight (the validator guarantees ≥60).
 */
export function selectExamQuestions(pool: SourceQuestion[]): SelectedQuestion[] {
  const byDomain = new Map<string, SourceQuestion[]>();
  for (const q of pool) {
    const list = byDomain.get(q.domain) ?? [];
    list.push(q);
    byDomain.set(q.domain, list);
  }

  const picked: SourceQuestion[] = [];
  for (const [domain, need] of Object.entries(EXAM_DOMAIN_WEIGHTS)) {
    const available = byDomain.get(domain) ?? [];
    if (available.length < need) {
      throw new Error(
        `Exam selection: domain "${domain}" needs ${need} hard questions, has ${available.length}`
      );
    }
    picked.push(...shuffleInPlace([...available]).slice(0, need));
  }

  shuffleInPlace(picked);

  return picked.map((q, idx) => {
    const canonical = JSON.parse(q.options) as CanonicalOptions;
    const { shuffled, permutation } = shuffleOptions(canonical);
    return {
      questionId: q.id,
      orderIndex: idx,
      stem: q.stem,
      shuffled,
      permutation,
    };
  });
}
```

- [ ] **Step 2: Verify with a throwaway script**

Create `scripts/_verify-select.ts`:

```typescript
import { selectExamQuestions, EXAM_DOMAIN_WEIGHTS, EXAM_TOTAL, type SourceQuestion } from "../src/lib/exam/select";

// Build a synthetic pool: 20 per domain so weights are satisfiable.
const opts = JSON.stringify({ A: "a", B: "b", C: "c", D: "d" });
const pool: SourceQuestion[] = [];
let id = 1;
for (const domain of Object.keys(EXAM_DOMAIN_WEIGHTS)) {
  for (let i = 0; i < 20; i++) pool.push({ id: id++, domain, stem: `q${id}`, options: opts });
}
const sel = selectExamQuestions(pool);
const counts: Record<string, number> = {};
const seen = new Set<number>();
for (const s of sel) {
  const d = pool.find((p) => p.id === s.questionId)!.domain;
  counts[d] = (counts[d] ?? 0) + 1;
  if (seen.has(s.questionId)) throw new Error("duplicate question in selection");
  seen.add(s.questionId);
}
const orders = sel.map((s) => s.orderIndex).sort((a, b) => a - b);
const orderOk = orders.every((o, i) => o === i);
console.assert(sel.length === EXAM_TOTAL, `expected ${EXAM_TOTAL}, got ${sel.length}`);
console.assert(JSON.stringify(counts) === JSON.stringify(EXAM_DOMAIN_WEIGHTS), `weights mismatch: ${JSON.stringify(counts)}`);
console.assert(orderOk, "orderIndex not 0..n-1 contiguous");
console.log("select OK:", sel.length, counts, "orderContiguous:", orderOk);
```

Run: `npx tsx scripts/_verify-select.ts`
Expected: `select OK: 60 {"Agentic":16,"Claude Code":12,"Prompts":12,"Tool & MCP":11,"Context":9} orderContiguous: true` and no assertion errors.
Then delete it: `rm scripts/_verify-select.ts`

- [ ] **Step 3: Build + commit**

Run: `npm run build` → no type errors.

```bash
git add src/lib/exam/select.ts
git commit -m "feat(exam): question selection lib (weighted, shuffled, replayable)"
```

---

### Task 3: Exam scoring + readiness lib

**Files:**
- Create: `src/lib/exam/score.ts`

**Interfaces:**
- Consumes: `grade` from `@/lib/tutor/grade`; `parsePermutation`, `translateToCanonical` from `@/lib/tutor/shuffle`; `DOMAIN_LABELS` from `@/lib/domains`.
- Produces:
  - `type GradedAnswer = { domain: string; correct: boolean }`
  - `gradeAnswer(question: { correctKey: string; distractorReasons: string }, chosenKeyShuffled: string | null, permutationJson: string): boolean`
  - `type PerDomain = Record<string, { correct: number; total: number }>`
  - `summarize(graded: GradedAnswer[]): { correctCount: number; total: number; overallPct: number; perDomain: PerDomain }`
  - `type Verdict = { ready: boolean; label: string }`
  - `verdict(overallPct: number, perDomain: PerDomain): Verdict`
  - `type Readiness = { overallPct: number; perDomain: PerDomain; weakestDomain: string | null; verdict: Verdict }`
  - `readinessFrom(correctCount: number, total: number, perDomainJson: string): Readiness`
  - `READY_OVERALL = 90`, `READY_DOMAIN = 75`

- [ ] **Step 1: Write score.ts**

Create `src/lib/exam/score.ts`:

```typescript
import { grade } from "@/lib/tutor/grade";
import { parsePermutation, translateToCanonical } from "@/lib/tutor/shuffle";

export const READY_OVERALL = 90;
export const READY_DOMAIN = 75;

export type GradedAnswer = { domain: string; correct: boolean };
export type PerDomain = Record<string, { correct: number; total: number }>;
export type Verdict = { ready: boolean; label: string };
export type Readiness = {
  overallPct: number;
  perDomain: PerDomain;
  weakestDomain: string | null;
  verdict: Verdict;
};

/**
 * Grade one answer. chosenKeyShuffled is the letter the student saw/clicked;
 * translate it back to canonical via the stored permutation before grading.
 * null (unanswered) is wrong.
 */
export function gradeAnswer(
  question: { correctKey: string; distractorReasons: string },
  chosenKeyShuffled: string | null,
  permutationJson: string
): boolean {
  if (!chosenKeyShuffled) return false;
  const perm = parsePermutation(permutationJson);
  const canonicalChosen = perm
    ? translateToCanonical(chosenKeyShuffled, perm) ?? chosenKeyShuffled
    : chosenKeyShuffled;
  return grade(question, canonicalChosen).correct;
}

export function summarize(graded: GradedAnswer[]): {
  correctCount: number;
  total: number;
  overallPct: number;
  perDomain: PerDomain;
} {
  const perDomain: PerDomain = {};
  let correctCount = 0;
  for (const g of graded) {
    const d = (perDomain[g.domain] ??= { correct: 0, total: 0 });
    d.total += 1;
    if (g.correct) {
      d.correct += 1;
      correctCount += 1;
    }
  }
  const total = graded.length;
  const overallPct = total === 0 ? 0 : Math.round((correctCount / total) * 100);
  return { correctCount, total, overallPct, perDomain };
}

export function verdict(overallPct: number, perDomain: PerDomain): Verdict {
  const domainsOk = Object.values(perDomain).every(
    (d) => d.total === 0 || (d.correct / d.total) * 100 >= READY_DOMAIN
  );
  const ready = overallPct >= READY_OVERALL && domainsOk;
  return {
    ready,
    label: ready
      ? "Ready to sit the real exam"
      : "Keep training — not ready yet",
  };
}

export function readinessFrom(
  correctCount: number,
  total: number,
  perDomainJson: string
): Readiness {
  const overallPct = total === 0 ? 0 : Math.round((correctCount / total) * 100);
  let perDomain: PerDomain = {};
  try {
    perDomain = JSON.parse(perDomainJson) as PerDomain;
  } catch {
    perDomain = {};
  }
  let weakestDomain: string | null = null;
  let weakestPct = Infinity;
  for (const [d, v] of Object.entries(perDomain)) {
    if (v.total === 0) continue;
    const pct = (v.correct / v.total) * 100;
    if (pct < weakestPct) {
      weakestPct = pct;
      weakestDomain = d;
    }
  }
  return { overallPct, perDomain, weakestDomain, verdict: verdict(overallPct, perDomain) };
}
```

- [ ] **Step 2: Verify with a throwaway script**

Create `scripts/_verify-score.ts`:

```typescript
import { summarize, verdict, readinessFrom, gradeAnswer } from "../src/lib/exam/score";

// gradeAnswer: identity permutation, correctKey B
const q = { correctKey: "B", distractorReasons: "{}" };
const identity = JSON.stringify({ A: "A", B: "B", C: "C", D: "D" });
console.assert(gradeAnswer(q, "B", identity) === true, "B should be correct");
console.assert(gradeAnswer(q, "A", identity) === false, "A should be wrong");
console.assert(gradeAnswer(q, null, identity) === false, "null should be wrong");

const graded = [
  { domain: "Agentic", correct: true },
  { domain: "Agentic", correct: false },
  { domain: "Context", correct: true },
];
const s = summarize(graded);
console.assert(s.correctCount === 2 && s.total === 3 && s.overallPct === 67, `summarize: ${JSON.stringify(s)}`);
console.assert(s.perDomain.Agentic.correct === 1 && s.perDomain.Agentic.total === 2, "perDomain Agentic");

console.assert(verdict(91, { X: { correct: 8, total: 10 } }).ready === true, "91% + 80% domain → ready");
console.assert(verdict(91, { X: { correct: 7, total: 10 } }).ready === false, "domain 70% → not ready");
console.assert(verdict(89, { X: { correct: 10, total: 10 } }).ready === false, "89% overall → not ready");

const r = readinessFrom(54, 60, JSON.stringify({ Agentic: { correct: 10, total: 16 }, Context: { correct: 9, total: 9 } }));
console.assert(r.overallPct === 90, `readiness overall ${r.overallPct}`);
console.assert(r.weakestDomain === "Agentic", `weakest ${r.weakestDomain}`);
console.log("score OK", s, r.weakestDomain, r.verdict.ready);
```

Run: `npx tsx scripts/_verify-score.ts`
Expected: `score OK ...` with no assertion errors.
Then delete it: `rm scripts/_verify-score.ts`

- [ ] **Step 3: Build + commit**

Run: `npm run build` → no type errors.

```bash
git add src/lib/exam/score.ts
git commit -m "feat(exam): scoring, verdict, and readiness lib"
```

---

### Task 4: `POST /api/exam/start`

**Files:**
- Create: `src/app/api/exam/start/route.ts`

**Interfaces:**
- Consumes: `selectExamQuestions`, `EXAM_TOTAL`, `SourceQuestion` (Task 2); `prisma`.
- Produces: `POST /api/exam/start` → `{ attemptId: number }`. Creates one `ExamAttempt` (status in_progress) and its `ExamAnswer` rows (permutation persisted, chosenKey null). Returns NO question text.

- [ ] **Step 1: Write the route**

Create `src/app/api/exam/start/route.ts`:

```typescript
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { selectExamQuestions, EXAM_TOTAL, type SourceQuestion } from "@/lib/exam/select";

const STUDENT_ID = "default";

export async function POST() {
  try {
    const pool = (await prisma.question.findMany({
      where: { difficulty: "hard" },
      select: { id: true, domain: true, stem: true, options: true },
    })) as SourceQuestion[];

    const selected = selectExamQuestions(pool);

    const attempt = await prisma.examAttempt.create({
      data: {
        studentId: STUDENT_ID,
        status: "in_progress",
        totalQuestions: selected.length,
        durationLimitSec: 7200,
        answers: {
          create: selected.map((s) => ({
            questionId: s.questionId,
            orderIndex: s.orderIndex,
            permutation: JSON.stringify(s.permutation),
          })),
        },
      },
    });

    return NextResponse.json({ attemptId: attempt.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/exam/start]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

void EXAM_TOTAL; // referenced for clarity; selection enforces the count
```

(Remove the trailing `void EXAM_TOTAL;` line if your linter prefers — it is only a documentation hook.)

- [ ] **Step 2: Build + commit**

Run: `npm run build` → no type errors. (End-to-end runtime verification happens in Task 12 once the DB has the migration.)

```bash
git add src/app/api/exam/start/route.ts
git commit -m "feat(exam): POST /api/exam/start"
```

---

### Task 5: `POST /api/exam/answer` (autosave)

**Files:**
- Create: `src/app/api/exam/answer/route.ts`

**Interfaces:**
- Consumes: `prisma`; `isOptionKey` from `@/lib/tutor/shuffle`.
- Produces: `POST /api/exam/answer` with body `{ attemptId: number; questionId: number; chosenKey: string }` → `{ ok: true }`. Upserts `ExamAnswer.chosenKey`. Rejects if the attempt is already submitted.

- [ ] **Step 1: Write the route**

Create `src/app/api/exam/answer/route.ts`:

```typescript
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isOptionKey } from "@/lib/tutor/shuffle";

const STUDENT_ID = "default";

export async function POST(req: Request) {
  try {
    const { attemptId, questionId, chosenKey } = (await req.json()) as {
      attemptId?: number;
      questionId?: number;
      chosenKey?: string;
    };
    if (typeof attemptId !== "number" || typeof questionId !== "number" || !isOptionKey(chosenKey)) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const attempt = await prisma.examAttempt.findFirst({
      where: { id: attemptId, studentId: STUDENT_ID },
      select: { status: true },
    });
    if (!attempt) return NextResponse.json({ error: "attempt not found" }, { status: 404 });
    if (attempt.status !== "in_progress") {
      return NextResponse.json({ error: "attempt already closed" }, { status: 409 });
    }

    await prisma.examAnswer.updateMany({
      where: { attemptId, questionId },
      data: { chosenKey },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/exam/answer]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Build + commit**

Run: `npm run build` → no type errors.

```bash
git add src/app/api/exam/answer/route.ts
git commit -m "feat(exam): POST /api/exam/answer autosave"
```

---

### Task 6: `POST /api/exam/submit`

**Files:**
- Create: `src/app/api/exam/submit/route.ts`

**Interfaces:**
- Consumes: `prisma`; `gradeAnswer`, `summarize` from `@/lib/exam/score`.
- Produces: `POST /api/exam/submit` with body `{ attemptId: number }` → `{ ok: true }`. Grades every `ExamAnswer`, writes `correct`, sets `correctCount`/`perDomain`/`submittedAt`/`status`. Idempotent if already submitted (returns ok). Marks `expired` if past the limit but still grades saved answers.

- [ ] **Step 1: Write the route**

Create `src/app/api/exam/submit/route.ts`:

```typescript
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gradeAnswer, summarize, type GradedAnswer } from "@/lib/exam/score";

const STUDENT_ID = "default";

export async function POST(req: Request) {
  try {
    const { attemptId } = (await req.json()) as { attemptId?: number };
    if (typeof attemptId !== "number") {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const attempt = await prisma.examAttempt.findFirst({
      where: { id: attemptId, studentId: STUDENT_ID },
      include: { answers: { include: { question: true } } },
    });
    if (!attempt) return NextResponse.json({ error: "attempt not found" }, { status: 404 });
    if (attempt.status !== "in_progress") {
      return NextResponse.json({ ok: true }); // idempotent
    }

    const graded: GradedAnswer[] = [];
    for (const a of attempt.answers) {
      const correct = gradeAnswer(
        { correctKey: a.question.correctKey, distractorReasons: a.question.distractorReasons },
        a.chosenKey,
        a.permutation
      );
      graded.push({ domain: a.question.domain, correct });
      await prisma.examAnswer.update({ where: { id: a.id }, data: { correct } });
    }

    const { correctCount, perDomain } = summarize(graded);

    const elapsedSec =
      (Date.now() - attempt.startedAt.getTime()) / 1000;
    const status = elapsedSec > attempt.durationLimitSec ? "expired" : "submitted";

    await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        correctCount,
        perDomain: JSON.stringify(perDomain),
        submittedAt: new Date(),
        status,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/exam/submit]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Build + commit**

Run: `npm run build` → no type errors.

```bash
git add src/app/api/exam/submit/route.ts
git commit -m "feat(exam): POST /api/exam/submit (server-side grading)"
```

---

### Task 7: Exam start page `/exam`

**Files:**
- Create: `src/app/exam/page.tsx`
- Create: `src/app/exam/StartExamButton.tsx`

**Interfaces:**
- Consumes: `prisma`; `readinessFrom` from `@/lib/exam/score`. Calls `POST /api/exam/start`, then navigates to `/exam/[attemptId]`.

- [ ] **Step 1: Write the start button (client)**

Create `src/app/exam/StartExamButton.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartExamButton() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/exam/start", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Start failed (${res.status})`);
      }
      const { attemptId } = (await res.json()) as { attemptId: number };
      router.push(`/exam/${attemptId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={() => void start()}
        disabled={starting}
        className="px-8 py-3 bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900 rounded-lg font-semibold text-sm hover:bg-stone-700 dark:hover:bg-stone-200 transition-colors disabled:opacity-60"
      >
        {starting ? "Starting…" : "Start exam"}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Write the start page (server)**

Create `src/app/exam/page.tsx`:

```typescript
export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { readinessFrom } from "@/lib/exam/score";
import StartExamButton from "./StartExamButton";

const STUDENT_ID = "default";

export default async function ExamStartPage() {
  const last = await prisma.examAttempt.findFirst({
    where: { studentId: STUDENT_ID, status: { in: ["submitted", "expired"] } },
    orderBy: { submittedAt: "desc" },
  });
  const lastReadiness = last
    ? readinessFrom(last.correctCount, last.totalQuestions, last.perDomain)
    : null;

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center px-6">
      <div className="max-w-lg w-full space-y-6 text-center">
        <Link href="/" className="text-xs text-stone-400 hover:underline">← Home</Link>
        <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100" style={{ fontFamily: "Georgia, serif" }}>
          Mock Exam
        </h1>
        <ul className="text-sm text-stone-600 dark:text-stone-300 space-y-1">
          <li>60 questions · 120 minutes · timed</li>
          <li>One attempt runs at a time — no help, no pausing the clock</li>
          <li>Above real-exam difficulty; ready = ≥90% overall and no domain below 75%</li>
          <li>Independent of your tutoring progress — retake as often as you like</li>
        </ul>
        {lastReadiness && (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Last attempt: <strong>{lastReadiness.overallPct}%</strong>
            {lastReadiness.weakestDomain ? ` · weakest: ${lastReadiness.weakestDomain}` : ""}
          </p>
        )}
        <StartExamButton />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Build + commit**

Run: `npm run build` → no type errors.

```bash
git add src/app/exam/page.tsx src/app/exam/StartExamButton.tsx
git commit -m "feat(exam): /exam start screen"
```

---

### Task 8: Exam runner `/exam/[attemptId]`

**Files:**
- Create: `src/app/exam/[attemptId]/page.tsx`
- Create: `src/app/exam/[attemptId]/ExamRunner.tsx`

**Interfaces:**
- Consumes: `prisma`; `parsePermutation` from `@/lib/tutor/shuffle`; `redirect` from `next/navigation`. Calls `POST /api/exam/answer` and `POST /api/exam/submit`.
- Produces: a client `ExamRunner` taking `{ attemptId: number; remainingSec: number; questions: RunnerQuestion[] }` where `RunnerQuestion = { orderIndex: number; questionId: number; stem: string; options: Record<"A"|"B"|"C"|"D", string>; chosen: string | null }`.

- [ ] **Step 1: Write the server page (rebuilds shuffled presentation from permutation)**

Create `src/app/exam/[attemptId]/page.tsx`:

```typescript
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parsePermutation, KEYS, type CanonicalOptions } from "@/lib/tutor/shuffle";
import ExamRunner, { type RunnerQuestion } from "./ExamRunner";

const STUDENT_ID = "default";

export default async function ExamRunnerPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId: attemptIdStr } = await params;
  const attemptId = Number(attemptIdStr);
  if (!Number.isFinite(attemptId)) redirect("/exam");

  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, studentId: STUDENT_ID },
    include: {
      answers: {
        orderBy: { orderIndex: "asc" },
        include: { question: { select: { stem: true, options: true } } },
      },
    },
  });
  if (!attempt) redirect("/exam");
  if (attempt.status !== "in_progress") redirect(`/exam/${attemptId}/result`);

  const questions: RunnerQuestion[] = attempt.answers.map((a) => {
    const canonical = JSON.parse(a.question.options) as CanonicalOptions;
    const perm = parsePermutation(a.permutation);
    // Rebuild what the student saw: shuffledPosition -> canonical[perm[position]]
    const options = {} as Record<"A" | "B" | "C" | "D", string>;
    for (const pos of KEYS) {
      const canonicalKey = perm ? perm[pos] : pos;
      options[pos] = canonical[canonicalKey];
    }
    return {
      orderIndex: a.orderIndex,
      questionId: a.questionId,
      stem: a.question.stem,
      options,
      chosen: a.chosenKey,
    };
  });

  const elapsedSec = (Date.now() - attempt.startedAt.getTime()) / 1000;
  const remainingSec = Math.max(0, Math.round(attempt.durationLimitSec - elapsedSec));

  return <ExamRunner attemptId={attemptId} remainingSec={remainingSec} questions={questions} />;
}
```

- [ ] **Step 2: Write the runner (client)**

Create `src/app/exam/[attemptId]/ExamRunner.tsx`:

```typescript
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export type RunnerQuestion = {
  orderIndex: number;
  questionId: number;
  stem: string;
  options: Record<"A" | "B" | "C" | "D", string>;
  chosen: string | null;
};

const KEYS = ["A", "B", "C", "D"] as const;

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ExamRunner({
  attemptId,
  remainingSec,
  questions,
}: {
  attemptId: number;
  remainingSec: number;
  questions: RunnerQuestion[];
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const q of questions) if (q.chosen) init[q.questionId] = q.chosen;
    return init;
  });
  const [remaining, setRemaining] = useState(remainingSec);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await fetch("/api/exam/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId }),
      });
    } finally {
      router.push(`/exam/${attemptId}/result`);
    }
  }, [attemptId, router]);

  // Countdown; auto-submit at zero.
  useEffect(() => {
    if (remaining <= 0) {
      void submit();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, submit]);

  const choose = (questionId: number, key: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: key }));
    void fetch("/api/exam/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, questionId, chosenKey: key }),
    });
  };

  const q = questions[idx];
  const answeredCount = Object.keys(answers).length;

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <header className="border-b border-stone-200 dark:border-stone-800 px-6 py-3 flex items-center justify-between sticky top-0 bg-white/90 dark:bg-stone-900/90 backdrop-blur">
        <span className="text-sm font-semibold">Mock Exam</span>
        <span className="text-sm tabular-nums">
          {answeredCount}/{questions.length} answered · ⏱ {fmt(remaining)}
        </span>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        <p className="text-xs text-stone-400">Question {idx + 1} of {questions.length}</p>
        <p className="text-base leading-relaxed whitespace-pre-wrap">{q.stem}</p>

        <div className="space-y-2">
          {KEYS.map((k) => {
            const selected = answers[q.questionId] === k;
            return (
              <button
                key={k}
                onClick={() => choose(q.questionId, k)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  selected
                    ? "border-stone-900 dark:border-stone-100 bg-stone-100 dark:bg-stone-800"
                    : "border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                }`}
              >
                <span className="font-semibold mr-2">{k}</span>
                {q.options[k]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="px-4 py-2 text-sm rounded border border-stone-300 dark:border-stone-700 disabled:opacity-40"
          >
            ← Prev
          </button>
          {idx < questions.length - 1 ? (
            <button
              onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}
              className="px-4 py-2 text-sm rounded bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={() => void submit()}
              disabled={submitting}
              className="px-5 py-2 text-sm rounded bg-emerald-700 text-white disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit exam"}
            </button>
          )}
        </div>

        {/* Question navigator */}
        <div className="grid grid-cols-10 gap-1.5 pt-4">
          {questions.map((qq, i) => {
            const isAnswered = answers[qq.questionId] !== undefined;
            const isCurrent = i === idx;
            return (
              <button
                key={qq.questionId}
                onClick={() => setIdx(i)}
                className={`h-8 text-xs rounded ${
                  isCurrent
                    ? "ring-2 ring-stone-900 dark:ring-stone-100 "
                    : ""
                }${
                  isAnswered
                    ? "bg-stone-300 dark:bg-stone-600"
                    : "bg-stone-100 dark:bg-stone-800 text-stone-400"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => void submit()}
          disabled={submitting}
          className="w-full mt-2 px-5 py-3 text-sm rounded-lg bg-emerald-700 text-white disabled:opacity-60"
        >
          {submitting ? "Submitting…" : `Submit exam (${answeredCount}/${questions.length} answered)`}
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Build + commit**

Run: `npm run build` → no type errors.

```bash
git add "src/app/exam/[attemptId]/page.tsx" "src/app/exam/[attemptId]/ExamRunner.tsx"
git commit -m "feat(exam): timed runner with navigator + autosave"
```

---

### Task 9: Result page `/exam/[attemptId]/result`

**Files:**
- Create: `src/app/exam/[attemptId]/result/page.tsx`

**Interfaces:**
- Consumes: `prisma`; `readinessFrom` from `@/lib/exam/score`; `grade` from `@/lib/tutor/grade`; `parsePermutation`, `invertPermutation`, `remapByPermutation`, `KEYS`, `type CanonicalOptions` from `@/lib/tutor/shuffle`; `DOMAIN_LABELS` from `@/lib/domains`; `redirect`.

- [ ] **Step 1: Write the result page (server)**

Create `src/app/exam/[attemptId]/result/page.tsx`:

```typescript
export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readinessFrom } from "@/lib/exam/score";
import { grade } from "@/lib/tutor/grade";
import {
  parsePermutation,
  invertPermutation,
  remapByPermutation,
  KEYS,
  type CanonicalOptions,
} from "@/lib/tutor/shuffle";
import { DOMAIN_LABELS } from "@/lib/domains";

const STUDENT_ID = "default";

export default async function ExamResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId: attemptIdStr } = await params;
  const attemptId = Number(attemptIdStr);
  if (!Number.isFinite(attemptId)) redirect("/exam");

  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, studentId: STUDENT_ID },
    include: {
      answers: {
        orderBy: { orderIndex: "asc" },
        include: { question: true },
      },
    },
  });
  if (!attempt) redirect("/exam");
  if (attempt.status === "in_progress") redirect(`/exam/${attemptId}`);

  const readiness = readinessFrom(attempt.correctCount, attempt.totalQuestions, attempt.perDomain);

  const review = attempt.answers.map((a) => {
    const canonical = JSON.parse(a.question.options) as CanonicalOptions;
    const perm = parsePermutation(a.permutation);
    const shuffledOptions = {} as Record<"A" | "B" | "C" | "D", string>;
    for (const pos of KEYS) shuffledOptions[pos] = canonical[perm ? perm[pos] : pos];

    const g = grade(a.question, perm ? (perm[(a.chosenKey ?? "A") as "A" | "B" | "C" | "D"] ?? "A") : a.chosenKey ?? "A");
    void g; // correctness already stored on a.correct
    const correctShuffledKey = perm
      ? invertPermutation(perm)[a.question.correctKey as "A" | "B" | "C" | "D"]
      : (a.question.correctKey as "A" | "B" | "C" | "D");
    const reasons = (() => {
      try {
        const canonicalReasons = JSON.parse(a.question.distractorReasons) as Record<string, string>;
        return perm ? remapByPermutation(canonicalReasons, perm) : canonicalReasons;
      } catch {
        return {} as Record<string, string>;
      }
    })();

    return {
      orderIndex: a.orderIndex,
      stem: a.question.stem,
      domain: a.question.domain,
      options: shuffledOptions,
      chosen: a.chosenKey,
      correct: a.correct,
      correctKey: correctShuffledKey,
      reasons,
    };
  });

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xs text-stone-400 hover:underline">← Home</Link>
          <Link href="/exam" className="text-xs text-stone-400 hover:underline">Retake →</Link>
        </div>

        <section className="text-center space-y-2">
          <p className="text-xs uppercase tracking-widest text-stone-400">Result</p>
          <h1 className="text-5xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
            {readiness.overallPct}%
          </h1>
          <p className={`text-sm font-medium ${readiness.verdict.ready ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
            {readiness.verdict.label}
          </p>
          <p className="text-xs text-stone-400">
            {attempt.correctCount}/{attempt.totalQuestions} correct · real exam passes at 720/1000
            {attempt.status === "expired" ? " · time expired" : ""}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">By domain</h2>
          {Object.entries(readiness.perDomain).map(([domain, d]) => {
            const pct = d.total ? Math.round((d.correct / d.total) * 100) : 0;
            const weak = pct < 75;
            return (
              <div key={domain} className="flex items-center gap-3 text-sm">
                <span className="w-56 shrink-0 text-stone-600 dark:text-stone-300">
                  {DOMAIN_LABELS[domain] ?? domain}
                </span>
                <div className="flex-1 h-2 rounded bg-stone-200 dark:bg-stone-800 overflow-hidden">
                  <div className={`h-full ${weak ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 text-right tabular-nums">{d.correct}/{d.total}</span>
              </div>
            );
          })}
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold">Review</h2>
          {review.map((r) => (
            <div key={r.orderIndex} className="border border-stone-200 dark:border-stone-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-400">Q{r.orderIndex + 1} · {DOMAIN_LABELS[r.domain] ?? r.domain}</span>
                <span className={r.correct ? "text-emerald-600" : "text-red-600"}>
                  {r.correct ? "✓ Correct" : `✗ Your answer: ${r.chosen ?? "—"} · Correct: ${r.correctKey}`}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{r.stem}</p>
              <ul className="space-y-1 text-sm">
                {KEYS.map((k) => {
                  const isCorrect = k === r.correctKey;
                  const isChosen = k === r.chosen;
                  return (
                    <li key={k} className={`px-3 py-2 rounded ${isCorrect ? "bg-emerald-50 dark:bg-emerald-950/40" : isChosen ? "bg-red-50 dark:bg-red-950/40" : ""}`}>
                      <span className="font-semibold mr-2">{k}</span>{r.options[k]}
                      {r.reasons[k] ? <p className="mt-1 text-xs text-stone-500">{r.reasons[k]}</p> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Build + commit**

Run: `npm run build` → no type errors.

```bash
git add "src/app/exam/[attemptId]/result/page.tsx"
git commit -m "feat(exam): result page with per-domain breakdown + review"
```

---

### Task 10: Ledger Exam History section

**Files:**
- Modify: `src/lib/ledger-render.ts`

**Interfaces:**
- Consumes: `prisma` (already imported in the file), `readinessFrom` from `@/lib/exam/score`.

- [ ] **Step 1: Add an Exam History section to renderLedger**

In `src/lib/ledger-render.ts`, add the import at the top (after the existing imports):

```typescript
import { readinessFrom } from "@/lib/exam/score";
```

Inside `renderLedger`, after the student is loaded (the `prisma.student.findUnique` block) add a query for exam attempts:

```typescript
  const examAttempts = await prisma.examAttempt.findMany({
    where: { studentId, status: { in: ["submitted", "expired"] } },
    orderBy: { submittedAt: "desc" },
    take: 10,
  });
```

Build the section markdown (place this near where other section strings are built):

```typescript
  const examHistory =
    examAttempts.length === 0
      ? "_No exams taken yet._"
      : [
          "| Date | Score | Weakest domain | Verdict |",
          "|---|---|---|---|",
          ...examAttempts.map((a) => {
            const r = readinessFrom(a.correctCount, a.totalQuestions, a.perDomain);
            const date = (a.submittedAt ?? a.startedAt).toISOString().slice(0, 10);
            return `| ${date} | ${r.overallPct}% | ${r.weakestDomain ?? "—"} | ${r.verdict.ready ? "Ready" : "Keep training"} |`;
          }),
        ].join("\n");
```

In the returned markdown template string, add this section immediately before the `## [Sprint Notes]` section:

```typescript
## [Exam History]

${examHistory}

```

- [ ] **Step 2: Verify + commit**

Run: `npm run build` → no type errors.
Run: `npm run validate:content` → still `Content validation passed: 22 concepts, 93 questions, 23 hours.`

```bash
git add src/lib/ledger-render.ts
git commit -m "feat(ledger): exam history section"
```

---

### Task 11: Bento landing page

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `prisma`; `getMasterySnapshot` from `@/lib/tutor/mastery`; `readinessFrom` from `@/lib/exam/score`; `HOUR_TOPICS` from `@/lib/hour-topics`.

This task implements the bento grid from the approved Direction E mockup. **After writing the functional structure below, use the `anthropic-skills:frontend-design` skill to refine the visual polish (spacing, type scale, accent, dark-mode contrast) — keep the data wiring and links intact.**

- [ ] **Step 1: Rewrite the home page as a bento grid (server component)**

Replace the entire contents of `src/app/page.tsx` with:

```typescript
export const dynamic = "force-dynamic";

import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import { prisma } from "@/lib/prisma";
import { getMasterySnapshot } from "@/lib/tutor/mastery";
import { readinessFrom } from "@/lib/exam/score";
import { HOUR_TOPICS } from "@/lib/hour-topics";

const STUDENT_ID = "default";

export default async function Home() {
  const student = await prisma.student.findUnique({ where: { id: STUDENT_ID } });
  const snapshot = student ? await getMasterySnapshot(STUDENT_ID) : null;

  const attempts = await prisma.examAttempt.findMany({
    where: { studentId: STUDENT_ID, status: { in: ["submitted", "expired"] } },
    orderBy: { submittedAt: "desc" },
    take: 5,
  });
  const last = attempts[0] ?? null;
  const readiness = last ? readinessFrom(last.correctCount, last.totalQuestions, last.perDomain) : null;
  const trend = [...attempts]
    .reverse()
    .map((a) => readinessFrom(a.correctCount, a.totalQuestions, a.perDomain).overallPct);

  const currentHour = snapshot?.currentHour ?? 0;
  const nextHour = Math.min(currentHour + 1, 23);
  const nextTopic = HOUR_TOPICS[nextHour] ?? "—";
  const daysRemaining = snapshot?.daysRemaining ?? null;

  const ringPct = readiness?.overallPct ?? 0;
  const circumference = 2 * Math.PI * 34;
  const dashOffset = circumference * (1 - ringPct / 100);

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <p className="text-xs tracking-[0.25em] uppercase text-stone-400">
            Claude Certified Architect — Foundations
          </p>
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[minmax(140px,auto)]">
          {/* Hero / exam CTA */}
          <section className="md:col-span-2 md:row-span-2 rounded-2xl border border-stone-200 dark:border-stone-800 bg-gradient-to-br from-amber-100/60 to-transparent dark:from-amber-900/20 p-7 flex flex-col justify-between">
            <div>
              <h1 className="text-4xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
                CCA-F Tutor
              </h1>
              <p className="mt-2 text-stone-500 dark:text-stone-400 text-sm">
                Architect-level fluency in 23 hours.
              </p>
            </div>
            <Link
              href="/exam"
              className="mt-6 inline-flex flex-col items-center justify-center rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900 py-4 font-semibold hover:bg-stone-700 dark:hover:bg-stone-200 transition-colors"
            >
              Take mock exam
              <span className="text-xs font-normal opacity-70 mt-0.5">60 questions · 120 min · timed</span>
            </Link>
          </section>

          {/* Readiness gauge */}
          <section className="rounded-2xl border border-stone-200 dark:border-stone-800 p-5 flex flex-col items-center justify-center text-center">
            <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-2">Readiness</p>
            {readiness ? (
              <>
                <div className="relative w-[88px] h-[88px]">
                  <svg viewBox="0 0 80 80" className="w-[88px] h-[88px]">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" className="text-stone-200 dark:text-stone-800" strokeWidth="7" />
                    <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" className="text-amber-600" strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} transform="rotate(-90 40 40)" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold" style={{ fontFamily: "Georgia, serif" }}>
                    {readiness.overallPct}%
                  </div>
                </div>
                <p className="text-xs text-stone-500 mt-2">
                  {readiness.verdict.ready ? "Ready" : "Almost ready"}
                </p>
              </>
            ) : (
              <Link href="/exam" className="text-sm text-stone-500 hover:underline">
                Take your first mock →
              </Link>
            )}
          </section>

          {/* Continue tutoring */}
          <Link
            href="/chat"
            className="rounded-2xl border border-stone-200 dark:border-stone-800 p-5 flex flex-col gap-1 hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors"
          >
            <span className="font-semibold text-sm">Continue tutoring</span>
            <span className="text-xs text-stone-500">
              {currentHour >= 23 ? "Sprint complete" : `Resume Hour ${nextHour} — ${nextTopic}`}
            </span>
            <span className="mt-auto text-[10px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 w-fit">
              Hour {currentHour} / 23
            </span>
          </Link>

          {/* Exam trend */}
          <section className="rounded-2xl border border-stone-200 dark:border-stone-800 p-5">
            <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-2">Exam trend</p>
            {trend.length >= 2 ? (
              <>
                <p className="text-lg" style={{ fontFamily: "Georgia, serif" }}>{trend.join(" → ")}</p>
                <div className="flex items-end gap-1 h-10 mt-2">
                  {trend.map((p, i) => (
                    <div key={i} className="flex-1 rounded-sm bg-amber-500/60" style={{ height: `${Math.max(8, p)}%` }} />
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-stone-500">Take two mocks to see your trend.</p>
            )}
          </section>

          {/* Progress & history */}
          <Link
            href="/ledger"
            className="md:col-span-2 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 flex items-center gap-4 hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors"
          >
            <div>
              <span className="font-semibold text-sm">Progress &amp; history</span>
              <p className="text-xs text-stone-500">
                Mastery by domain · {attempts.length} exam{attempts.length === 1 ? "" : "s"} taken
                {daysRemaining !== null ? ` · ${daysRemaining} days left` : ""}
              </p>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Polish with frontend-design**

Invoke the `anthropic-skills:frontend-design` skill to refine the bento grid's visual quality (accent color, type hierarchy, card depth, gauge styling, dark-mode contrast). Constraint: keep all `href`s (`/exam`, `/chat`, `/ledger`), the data wiring, and the empty-states intact.

- [ ] **Step 3: Build + commit**

Run: `npm run build` → no type errors.

```bash
git add src/app/page.tsx
git commit -m "feat(landing): bento-grid home with readiness gauge, exam CTA, trend"
```

---

### Task 12: Migrate, reseed, end-to-end smoke

**Files:** none (operational task)

- [ ] **Step 1: Back up + apply the migration**

```bash
cp ~/.cca-f-tutor/cca-f.db ~/.cca-f-tutor/cca-f.db.bak-exam-$(date +%Y%m%d)
npm run db:setup
```
Expected: migrate deploy applies `20260619120000_add_exam_tables`, seed runs, "Seed complete."

- [ ] **Step 2: End-to-end runtime smoke (start → answer → submit → verify independence)**

Start the dev server: `npm run dev` (note the port). Then create `scripts/_smoke-exam.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";
import os from "node:os";
const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: `file:${path.join(os.homedir(), ".cca-f-tutor", "cca-f.db")}` }) });

async function main() {
  const base = process.env.SMOKE_BASE!; // e.g. http://localhost:3000
  // snapshot tutor tables BEFORE
  const before = {
    attempts: await prisma.questionAttempt.count(),
    fetches: await prisma.questionFetch.count(),
    masteries: await prisma.conceptMastery.findMany({ select: { mastery: true } }),
  };

  const start = await (await fetch(`${base}/api/exam/start`, { method: "POST" })).json();
  const attemptId = start.attemptId as number;
  const answers = await prisma.examAnswer.findMany({ where: { attemptId }, orderBy: { orderIndex: "asc" } });
  if (answers.length !== 60) throw new Error(`expected 60 answers, got ${answers.length}`);

  // answer the first 30 'A'
  for (const a of answers.slice(0, 30)) {
    await fetch(`${base}/api/exam/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attemptId, questionId: a.questionId, chosenKey: "A" }) });
  }
  await fetch(`${base}/api/exam/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attemptId }) });

  const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId } });
  const perDomain = JSON.parse(attempt!.perDomain) as Record<string, { correct: number; total: number }>;
  const domainTotal = Object.values(perDomain).reduce((n, d) => n + d.total, 0);

  const after = {
    attempts: await prisma.questionAttempt.count(),
    fetches: await prisma.questionFetch.count(),
    masteries: await prisma.conceptMastery.findMany({ select: { mastery: true } }),
  };

  console.assert(attempt!.status === "submitted", `status ${attempt!.status}`);
  console.assert(domainTotal === 60, `perDomain totals ${domainTotal}`);
  console.assert(before.attempts === after.attempts, "QuestionAttempt count changed (should not)");
  console.assert(before.fetches === after.fetches, "QuestionFetch count changed (should not)");
  console.assert(JSON.stringify(before.masteries) === JSON.stringify(after.masteries), "mastery changed (should not)");
  console.log("exam smoke OK:", { score: attempt!.correctCount, domainTotal, tutorUntouched: before.attempts === after.attempts });
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Run: `SMOKE_BASE=http://localhost:PORT npx tsx scripts/_smoke-exam.ts` (use the dev port).
Expected: `exam smoke OK: { score: <n>, domainTotal: 60, tutorUntouched: true }` with no assertion errors — proving grading works, per-domain totals sum to 60, and the tutor's `QuestionAttempt`/`QuestionFetch`/mastery are untouched (the independence guarantee).
Then delete it: `rm scripts/_smoke-exam.ts`.

- [ ] **Step 3: Page-render smoke**

With the dev server running:
```bash
curl -s -o /dev/null -w "/ %{http_code}\n" http://localhost:PORT/
curl -s -o /dev/null -w "/exam %{http_code}\n" http://localhost:PORT/exam
curl -s -o /dev/null -w "/ledger %{http_code}\n" http://localhost:PORT/ledger
```
Expected: all `200`. Stop the dev server.

- [ ] **Step 4: Final validate + build**

```bash
npm run validate:content   # 22 concepts, 93 questions, 23 hours
npm run build              # no type errors
```

- [ ] **Step 5: Commit (if any stragglers) + done**

```bash
git status --short
```
Expected: clean except machine-local files. The smoke script is deleted and not committed. No new commit needed unless files remain.

---

## Self-Review (completed at plan time)

- **Spec coverage:** ExamAttempt/ExamAnswer tables → Task 1; selection by weights/shuffle/replayable → Task 2; scoring/verdict/readiness → Task 3; start/answer/submit APIs with leak-prevention → Tasks 4–6; start screen → Task 7; timed runner (server-anchored countdown, navigator, autosave) → Task 8; result report + per-domain + review → Task 9; ledger exam history → Task 10; bento landing (readiness gauge, exam CTA, trend, continue, progress) → Task 11; migrate/reseed + independence smoke → Task 12. All spec sections mapped.
- **Placeholder scan:** every code step contains complete code. UI tasks include full functional components; Task 11 Step 2 layers frontend-design polish on top of working code (not a placeholder — the code already works).
- **Type consistency:** `SelectedQuestion`/`SourceQuestion` (Task 2) match the start route's usage (Task 4). `gradeAnswer`/`summarize`/`readinessFrom`/`verdict` signatures (Task 3) match Tasks 6, 7, 9, 10, 11. `RunnerQuestion` type is defined in Task 8's `ExamRunner.tsx` and imported by its page. Permutation rebuild (shuffled[pos] = canonical[perm[pos]]) is identical in Task 8 and Task 9. Domain weights 16/12/12/11/9 and readiness thresholds (90/75) are consistent across Tasks 2, 3, 9, 11.
- **Independence guarantee** is explicitly asserted by the Task 12 smoke (tutor tables + mastery unchanged after a full exam).
- **Answer-leak**: `start` returns only `{attemptId}`; `answer` returns `{ok}`; runner rebuilds options from permutation; keyed answers/reasons appear only on the server-rendered result page. No endpoint serializes `correctKey`/`distractorReasons` pre-submit.
