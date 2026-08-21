# Billing Phase 1 Implementation Plan — Metering + Wallet + Enforcement

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Make the AI tutor metered and cost-safe: every `/api/turn` is measured by real Claude token usage, billed at a marked-up rate against a prepaid per-user credit wallet, with a small free trial. No payments yet (Phase 2). This makes the app safe to expose publicly and produces real cost-per-turn data.

**Architecture:** Additive. New billing logic lives in `src/lib/billing/*` + three new Prisma models. Enforcement is **pre-flight** (clean HTTP status before the stream opens). Metering is **post-stream** (usage rides back on the value the route already awaits; the browser byte-stream is never modified).

**Tech Stack:** Next.js 16 App Router, Prisma 7 + libsql SQLite, Anthropic SDK, Auth.js v5.

## Global Constraints

- **Node ≥ 22** for every build/migrate/tsx command (`nvm use 22` or prepend `/Users/afeesudheenp/.nvm/versions/node/v22.17.1/bin` to PATH).
- **Money unit:** integer **micro-dollars** (µ$), `$1 = 1_000_000 µ$`. Prisma `Int`. No floats until a final `Math.ceil`.
- **Models in use (pricing keys must match exactly):** `MODEL_TUTOR = "claude-sonnet-4-6"`, `MODEL_ROUTER = "claude-haiku-4-5-20251001"` (from `src/lib/anthropic.ts`).
- **SQLite has no enums** — use `String` for status/kind columns (matches existing `ExamAttempt.status`).
- **Migrations are hand-authored + `prisma migrate deploy`** (NOT `migrate dev` — the dev DB at `~/.cca-f-tutor/cca-f.db` holds real data). Match the format of existing folders under `prisma/migrations/`. Actual deploy happens in Task 6 with a backup; earlier tasks only `prisma generate` + build.
- **Env vars are read with safe defaults** so the app runs without them: `CCAF_MARKUP` (1.6), `CCAF_TRIAL_MICROS` (250000), `CCAF_KILL_SWITCH` (off), `CCAF_DAILY_USER_CAP_MICROS` (3000000), `CCAF_GLOBAL_DAILY_CAP_MICROS` (25000000).
- `src/lib/billing/usage.ts` and `pricing.ts` are **pure** (no `server-only`, no DB) so they're unit-testable; `wallet.ts`/`guards.ts` import `prisma` and ARE `server-only`.

---

### Task 1: Billing schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260628140000_add_billing/migration.sql`

**Add to `prisma/schema.prisma`** these three models, and add two back-relations to the existing `Student` model (`wallet Wallet?` and `creditTransactions CreditTransaction[]`):

```prisma
model Wallet {
  id                   Int       @id @default(autoincrement())
  studentId            String    @unique
  balanceMicros        Int       @default(0)
  lifetimeGrantMicros  Int       @default(0)
  lifetimeSpentMicros  Int       @default(0)
  freeTrialGrantedAt   DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  student              Student   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  usageEvents          UsageEvent[]
  transactions         CreditTransaction[]
}

model UsageEvent {
  id               Int      @id @default(autoincrement())
  walletId         Int
  studentId        String
  sessionId        Int?
  route            String
  stoppedAt        String
  modelBreakdown   String
  inputTokens      Int      @default(0)
  outputTokens     Int      @default(0)
  cacheReadTokens  Int      @default(0)
  cacheWriteTokens Int      @default(0)
  rawCostMicros    Int
  billedMicros     Int
  createdAt        DateTime @default(now())
  wallet           Wallet   @relation(fields: [walletId], references: [id], onDelete: Cascade)
  @@index([studentId, createdAt])
  @@index([sessionId])
}

model CreditTransaction {
  id                  Int      @id @default(autoincrement())
  walletId            Int
  studentId           String
  kind                String
  status              String   @default("completed")
  amountPaidCents     Int      @default(0)
  creditsMicros       Int
  stripeSessionId     String?  @unique
  stripePaymentIntent String?
  stripeEventId       String?  @unique
  idempotencyKey      String?  @unique
  createdAt           DateTime @default(now())
  wallet              Wallet   @relation(fields: [walletId], references: [id], onDelete: Cascade)
  @@index([studentId, createdAt])
}
```

**Migration SQL** — hand-author `CREATE TABLE` + indexes matching the models above (look at an existing migration like `prisma/migrations/20260628120000_add_auth_tables/migration.sql` for the exact column-type/quoting style; SQLite, `INTEGER`/`TEXT`/`DATETIME`, foreign keys with `ON DELETE CASCADE ON UPDATE CASCADE`, unique indexes for `Wallet.studentId`, `CreditTransaction.stripeSessionId`/`stripeEventId`/`idempotencyKey`, and the `@@index` indexes).

- [ ] **Step 1:** Add the 3 models + the 2 `Student` back-relations.
- [ ] **Step 2:** Hand-author the migration SQL.
- [ ] **Step 3:** `nvm use 22 && npx prisma generate && npm run build` → green. **Do NOT run migrate deploy** (Task 6 does, with backup).
- [ ] **Step 4: Commit** `git add prisma && git commit -m "feat(billing): Wallet/UsageEvent/CreditTransaction schema (additive)"`

---

### Task 2: Pure billing libs — usage + pricing

**Files:**
- Create: `src/lib/billing/usage.ts`, `src/lib/billing/pricing.ts`

**Interfaces (Produces):**
- `usage.ts`: `type TokenUsage = { inputTokens; outputTokens; cacheCreationTokens; cacheReadTokens }` (all `number`); `type ModelUsage = TokenUsage & { model: string }`; `const ZERO_USAGE: TokenUsage`; `fromSdkUsage(u: unknown): TokenUsage` (null-coalesce each SDK field — `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` — to 0); `addUsage(a: TokenUsage, b: TokenUsage): TokenUsage` (field-wise sum).
- `pricing.ts`: `PRICES` (µ$ per 1M tokens, keyed by model string); `MARKUP = Number(process.env.CCAF_MARKUP ?? 1.6)`; `rawCostMicros(u: ModelUsage): number` (**throw** if `PRICES[u.model]` is missing — never silently bill 0); `billedMicros(perModel: ModelUsage[]): { rawMicros: number; billedMicros: number }` where `rawMicros = ceil(Σ rawCostMicros)` and `billedMicros = ceil(rawMicros * MARKUP)`.

**`PRICES` table** (µ$ per 1M tokens; `in`/`out`/`cacheWrite`/`cacheRead`):
```ts
export const PRICES: Record<string, { in: number; out: number; cacheWrite: number; cacheRead: number }> = {
  "claude-sonnet-4-6":          { in: 3_000_000, out: 15_000_000, cacheWrite: 3_750_000, cacheRead: 300_000 },
  "claude-haiku-4-5":           { in: 1_000_000, out:  5_000_000, cacheWrite: 1_250_000, cacheRead: 100_000 },
  "claude-haiku-4-5-20251001":  { in: 1_000_000, out:  5_000_000, cacheWrite: 1_250_000, cacheRead: 100_000 },
};
```
`rawCostMicros` = `(inTok*in + outTok*out + cacheCreationTokens*cacheWrite + cacheReadTokens*cacheRead) / 1_000_000` (divide last; these are per-1M prices).

- [ ] **Step 1:** Write both files. NO `server-only` import (must be testable/importable).
- [ ] **Step 2:** Write `scripts/check-billing.ts` (a tsx assertion script): assert `addUsage`/`fromSdkUsage` sum correctly; `rawCostMicros({model:"claude-sonnet-4-6", inputTokens:1_000_000, outputTokens:0, cacheCreationTokens:0, cacheReadTokens:0})` === `3_000_000`; `billedMicros` applies markup + ceil; and that `rawCostMicros` THROWS on an unknown model. Use plain `console.assert`/throw.
- [ ] **Step 3:** `nvm use 22 && npx tsx scripts/check-billing.ts` → prints all-pass; then `npm run build` → green.
- [ ] **Step 4:** Remove `scripts/check-billing.ts` (throwaway), then **Commit** `git add src/lib/billing && git commit -m "feat(billing): token usage + pricing math (micro-dollars)"`

---

### Task 3: Wallet + guards

**Files:**
- Create: `src/lib/billing/wallet.ts`, `src/lib/billing/guards.ts`

**Interfaces:**
- Consumes: `PRICES`/`billedMicros` from `pricing.ts`; `ModelUsage` from `usage.ts`; `prisma` from `@/lib/prisma`; `Prisma` from `@prisma/client`.
- Produces (`wallet.ts`, all `server-only`):
  - `type Db = Prisma.TransactionClient | typeof prisma` — accept an optional tx client.
  - `ensureWallet(userId: string, db: Db = prisma): Promise<{ id: number; balanceMicros: number }>` — idempotent: if a `Wallet` for `studentId=userId` exists, return it; else create it with `balanceMicros = TRIAL_MICROS`, `lifetimeGrantMicros = TRIAL_MICROS`, `freeTrialGrantedAt = new Date()`, AND a nested `CreditTransaction { kind: "trial_grant", creditsMicros: TRIAL_MICROS, status: "completed" }`. `TRIAL_MICROS = Number(process.env.CCAF_TRIAL_MICROS ?? 250000)`. Anti-double-grant is guaranteed by `Wallet.studentId @unique` — handle a concurrent-create unique violation (`P2002`) by re-reading and returning the existing wallet.
  - `getBalanceMicros(userId: string): Promise<number>` — 0 if no wallet.
  - `chargeTurn(args: { userId: string; sessionId: number | null; route: string; perModel: ModelUsage[]; stoppedAt: string }): Promise<{ billedMicros: number; rawMicros: number; balanceMicros: number }>` — compute `{ rawMicros, billedMicros }` via `pricing.billedMicros(perModel)`; in ONE `prisma.$transaction`: insert a `UsageEvent` (summing token fields across `perModel`, `modelBreakdown = JSON.stringify(perModel)`), decrement `Wallet.balanceMicros` by `billedMicros`, increment `lifetimeSpentMicros` by `billedMicros`; return the post-debit balance. Balance may go slightly negative (bounded single-turn overdraft — acceptable per v1 enforcement choice).
  - `grantCredits(args: { userId: string; creditsMicros: number; kind: string; amountPaidCents?: number; stripeSessionId?: string; stripeEventId?: string; idempotencyKey?: string }): Promise<{ balanceMicros: number; alreadyApplied: boolean }>` — idempotent: if a `CreditTransaction` with the same `stripeSessionId`/`stripeEventId`/`idempotencyKey` exists, return `{ alreadyApplied: true }` without crediting; else in one tx add credits to balance + `lifetimeGrantMicros` and insert the `CreditTransaction`. (Used by Phase 2 webhook; build it now.)
  - `KILL_SWITCH_ON(): Promise<boolean>` — returns `process.env.CCAF_KILL_SWITCH === "on"` (async signature so a DB-backed flag can replace it later).
- Produces (`guards.ts`, `server-only`):
  - `startOfTodayUtc(): Date` — reuse the UTC-day computation pattern from `src/lib/ensure-student.ts`.
  - `dailyUserSpendMicros(userId: string): Promise<number>` — sum `UsageEvent.billedMicros where studentId=userId and createdAt >= startOfTodayUtc`.
  - `globalDailyRawMicros(): Promise<number>` — sum `UsageEvent.rawCostMicros where createdAt >= startOfTodayUtc` (tracks owner spend).
  - `overDailyUserCap(userId): Promise<boolean>` — `dailyUserSpendMicros >= Number(process.env.CCAF_DAILY_USER_CAP_MICROS ?? 3000000)`.
  - `overGlobalCap(): Promise<boolean>` — `globalDailyRawMicros >= Number(process.env.CCAF_GLOBAL_DAILY_CAP_MICROS ?? 25000000)`.

- [ ] **Step 1:** Write both files.
- [ ] **Step 2:** `nvm use 22 && npm run build` → green (type-checks against Task 1 schema + Task 2 pricing). Functional DB tests happen in Task 6.
- [ ] **Step 3: Commit** `git add src/lib/billing && git commit -m "feat(billing): wallet (ensure/charge/grant) + spend guards"`

---

### Task 4: Free-trial wallet grant on first login

**Files:**
- Modify: `src/lib/ensure-student.ts`

**Interfaces:** Consumes `ensureWallet` from `@/lib/billing/wallet`.

At the END of `ensureStudent(userId)` (after the existing student fast-path / claim / fresh-create logic has guaranteed a `Student` with id=userId exists), add `await ensureWallet(userId);`. Because the current function early-returns on the fast-path (`if (existing) return;`), restructure minimally so `ensureWallet(userId)` runs on ALL paths (fast-path, claim, fresh-create) — e.g. wrap the existing create/claim work in `if (!existing) { ...existing $transaction... }` and then call `await ensureWallet(userId)` unconditionally before returning. This also backfills wallets for students created before billing existed. `ensureWallet` is idempotent, so calling it every login is safe.

- [ ] **Step 1:** Make the edit (preserve the existing race-tolerant claim/create logic exactly; only change the control flow so `ensureWallet` always runs).
- [ ] **Step 2:** `nvm use 22 && npm run build` → green.
- [ ] **Step 3: Commit** `git add src/lib/ensure-student.ts && git commit -m "feat(billing): grant trial wallet on first login"`

---

### Task 5: Metering + enforcement integration (router, loop, both turn routes)

**Files:**
- Modify: `src/lib/router.ts`, `src/lib/tutor/loop.ts`, `src/app/api/turn/route.ts`, `src/app/api/turn/retry/route.ts`

**Interfaces:** Consumes `fromSdkUsage`/`addUsage`/`ZERO_USAGE`/`ModelUsage` (usage.ts), `chargeTurn`/`ensureWallet`/`KILL_SWITCH_ON` (wallet.ts), `overDailyUserCap`/`overGlobalCap` (guards.ts).

**router.ts:** Change `classifyIntent` return type to `Promise<{ intent: Intent; usage: TokenUsage; model: string }>`. On success: `usage: fromSdkUsage(response.usage), model: MODEL_ROUTER`. On the `catch` path: `{ intent: "freeform_chat", usage: ZERO_USAGE, model: MODEL_ROUTER }`. Keep all existing parsing/validation logic.

**loop.ts:** Add `usage: TokenUsage` and `model: string` to `LoopResult`. Initialize `let usage: TokenUsage = ZERO_USAGE;` and immediately after EACH `await stream.finalMessage()` do `usage = addUsage(usage, fromSdkUsage(response.usage));`. Add `usage` + `model: MODEL_TUTOR` to EVERY `return` (the `end_turn`/`stop_sequence` return, the unexpected-stop return, and the iteration-cap return). Do not touch the streaming/`onEvent` logic.

**Both routes** (`turn/route.ts` and `turn/retry/route.ts`) — apply the SAME pattern to each:
1. **Pre-flight, after the `student` 404 check and BEFORE `getOrCreateOpenSession`/`new ReadableStream`:**
   ```ts
   if (await KILL_SWITCH_ON()) return jsonErrorResponse("Service temporarily paused. Try again soon.", 503);
   const wallet = await ensureWallet(userId);
   if (wallet.balanceMicros <= 0) {
     return new Response(JSON.stringify({ error: "insufficient_credits", code: "INSUFFICIENT_CREDITS", balanceMicros: wallet.balanceMicros }), { status: 402, headers: { "Content-Type": "application/json" } });
   }
   if (await overGlobalCap()) return jsonErrorResponse("Service temporarily paused. Try again soon.", 503);
   if (await overDailyUserCap(userId)) return new Response(JSON.stringify({ error: "daily_cap", code: "DAILY_CAP" }), { status: 429, headers: { "Content-Type": "application/json" } });
   ```
2. **Update the `classifyIntent` call site** to destructure: `const { intent, usage: routerUsage, model: routerModel } = await classifyIntent({...});`
3. **After `runTutorLoop` resolves**, before sending `done`, charge (in its own try/catch so a billing glitch never breaks the user's reply):
   ```ts
   let balanceMicros: number | undefined;
   let costMicros: number | undefined;
   try {
     const perModel = [
       { model: routerModel, ...routerUsage },
       { model: loopResult.model, ...loopResult.usage },
     ];
     const charge = await chargeTurn({ userId, sessionId: session.id, route: "turn" /* or "turn_retry" */, perModel, stoppedAt: loopResult.stoppedAt });
     balanceMicros = charge.balanceMicros;
     costMicros = charge.billedMicros;
   } catch (e) {
     console.error("[billing] chargeTurn failed", e);
   }
   ```
4. **Add `balanceMicros` and `costMicros` to the existing `done` event** (alongside the current fields). Use `route: "turn"` in `turn/route.ts` and `route: "turn_retry"` in `turn/retry/route.ts`.

- [ ] **Step 1:** Apply router + loop changes.
- [ ] **Step 2:** Apply both route changes (pre-flight gate + destructure + post-loop charge + done fields).
- [ ] **Step 3:** `nvm use 22 && npm run build` → green; `grep -n "classifyIntent" src/app/api/turn/*/route.ts src/app/api/turn/route.ts` shows the destructured call sites.
- [ ] **Step 4: Commit** `git add src/lib/router.ts src/lib/tutor/loop.ts src/app/api/turn && git commit -m "feat(billing): meter token usage + enforce wallet balance on every turn"`

---

### Task 6: Env, migrate, and end-to-end verification

**Files:** `.env`, `.env.example` (operational otherwise)

- [ ] **Step 1: Env.** Append to `.env.example` (documented, blank/default) and `.env` (with chosen defaults): `CCAF_MARKUP=1.6`, `CCAF_TRIAL_MICROS=250000`, `CCAF_KILL_SWITCH=off`, `CCAF_DAILY_USER_CAP_MICROS=3000000`, `CCAF_GLOBAL_DAILY_CAP_MICROS=25000000`.
- [ ] **Step 2: Back up + migrate.** `cp ~/.cca-f-tutor/cca-f.db ~/.cca-f-tutor/cca-f.db.bak-billing-$(date +%Y%m%d-%H%M%S)` then `nvm use 22 && npx prisma migrate deploy` → applies `add_billing`. Verify the 3 tables exist and existing data (default student Hour 23, masteries, sessions) is intact.
- [ ] **Step 3: Trial grant.** Via a tsx harness (shim `server-only` as in prior tasks if importing `ensureStudent`/`ensureWallet`): call `ensureWallet("default")` (or sign in), assert a `Wallet` exists with `balanceMicros == 250000` and exactly one `trial_grant` `CreditTransaction`; call again → still one grant, balance unchanged.
- [ ] **Step 4: Metering accuracy + enforcement** (dev server on port 3000): with a signed-in session run one real chat turn → assert a `UsageEvent` row with non-zero input/output tokens, `billedMicros == ceil(rawMicros * 1.6)`, and `Wallet.balanceMicros` decreased by exactly `billedMicros`; the `done` event carries `balanceMicros`/`costMicros`. Then set that wallet's `balanceMicros = 0` and POST `/api/turn` → **402 insufficient_credits**, and assert **no new `UsageEvent`** (no Anthropic call). Set `CCAF_KILL_SWITCH=on` → **503** before any call.
- [ ] **Step 5: Restore + validate.** Restore the DB from the Step-2 backup (so no test rows linger under real ids), remove any throwaway tsx scripts, then `nvm use 22 && npm run validate:content && npm run build` → both green; `git status --short` clean except intended env files.
- [ ] **Step 6: Cost-per-turn note.** Record the observed average `rawCostMicros` per turn (from Step 4) in the commit message / ledger — this is the input for setting `MARKUP` and pack pricing before Phase 2.
- [ ] **Step 7: Commit** `git add .env.example && git commit -m "chore(billing): env defaults + Phase 1 migrate/verify"` (keep `.env` gitignored).

---

## Self-Review (plan-time)
- **Coverage:** schema → T1; pure math → T2; wallet/guards → T3; trial grant → T4; metering+enforcement wiring → T5; migrate+verify → T6. Every Phase-1 plan item maps.
- **Build coherence:** each task builds independently — T5 changes `classifyIntent`/`LoopResult` signatures AND their only call sites (the two routes) in the same task, so there is no intermediate broken build.
- **Type consistency:** `ModelUsage`/`TokenUsage` used identically across T2/T3/T5; `ensureWallet`/`chargeTurn` signatures match between T3 (def) and T4/T5 (use); pricing keys equal the `MODEL_*` constants.
- **Data safety:** no `migrate dev`; deploy is additive + backup-first (T6); enforcement makes no Anthropic call when out of credits.
