# Billing Phase 3 Implementation Plan — Alerting + Usage Page

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add (1) billing-failure alerting so a failed `chargeTurn`/Stripe-webhook surfaces beyond `console.error`, and (2) a user-facing `/billing` page showing balance, spend history, and purchases.

**Architecture:** Both additive. Alerting is one server-only util posting to an optional webhook, wired into the three existing failure sites. The billing page is a server component querying Prisma directly (mirroring `src/app/ledger/page.tsx`), with a small client "Top up" wrapper reusing the existing `TopUpModal`. Prompt caching (the margin lever) is already implemented; rate-limiting + minor hardening were deferred by the user.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + libsql, Auth.js v5. No new deps, no migration.

## Global Constraints
- **Node ≥ 22 + env for build:** `export PATH="/Users/afeesudheenp/.nvm/versions/node/v22.17.1/bin:$PATH" && set -a && . ./.env && set +a` then `npm run build`. Verify `node -v` = v22.
- Money in **micro-dollars**; display as `` `$${(micros/1e6).toFixed(2)}` `` (the pattern in `src/app/chat/ChatClient.tsx`).
- Reuse: `getBalanceMicros` (`src/lib/billing/wallet.ts`), `requireUserId`/`requireUserIdApi` (`src/lib/current-user.ts`), `TopUpModal` (`src/app/chat/TopUpModal.tsx`), `CREDIT_PACKS` (`src/lib/billing/packs.ts`). Page styling: stone/amber + dark-mode, mirror `src/app/ledger/page.tsx`.
- Reports go to `.superpowers/sdd/p3-task-N-report.md` (avoid colliding with earlier phases' report files).
- Alerting must be **best-effort**: never throw, never block the response; always `console.error` too.

---

### Task 1: Billing-failure alert utility + wiring

**Files:**
- Create: `src/lib/alert.ts`
- Modify: `src/app/api/turn/route.ts`, `src/app/api/turn/retry/route.ts`, `src/app/api/billing/webhook/route.ts`, `.env.example`

**Interfaces — Produces:** `notifyBillingFailure(context: string, detail: unknown): Promise<void>` (server-only). Always `console.error("[alert] " + context, detail)`; if `process.env.ALERT_WEBHOOK_URL` is set, additionally POST `{ text }` (Slack/Discord-compatible) inside try/catch. Never throws.

- [ ] **Step 1:** Implement `src/lib/alert.ts` — `import "server-only";`. Helper `safeStringify(detail)`: `try { return detail instanceof Error ? detail.message : JSON.stringify(detail); } catch { return String(detail); }`. `notifyBillingFailure(context, detail)`: first `console.error("[alert] " + context, detail)`; then `const url = process.env.ALERT_WEBHOOK_URL; if (url) { try { await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ text: \`CCA-F billing failure: ${context} — ${safeStringify(detail)}\` }) }); } catch (e) { console.error("[alert] webhook post failed", e); } }`. Returns `Promise<void>`; cannot throw.
- [ ] **Step 2:** Wire the three sites (import `notifyBillingFailure` from `@/lib/alert`):
  - `src/app/api/turn/route.ts`: the `catch (e) { console.error("[billing] chargeTurn failed", e); }` → `catch (e) { await notifyBillingFailure(\`chargeTurn failed (route=turn, user=${userId})\`, e); }`
  - `src/app/api/turn/retry/route.ts`: same → `await notifyBillingFailure(\`chargeTurn failed (route=turn_retry, user=${userId})\`, e);`
  - `src/app/api/billing/webhook/route.ts`: `catch (e) { console.error("[billing/webhook]", e); return new Response("grant failed", { status: 500 }); }` → `catch (e) { await notifyBillingFailure("stripe webhook grant failed", e); return new Response("grant failed", { status: 500 }); }` (keep the 500).
- [ ] **Step 3:** `.env.example` — append after the Stripe section: `# Optional: POST billing failures to a Slack/Discord-compatible incoming webhook.` then `ALERT_WEBHOOK_URL=`.
- [ ] **Step 4: Verify.** Shim `server-only` (mkdir `node_modules/server-only` with `{"name":"server-only","main":"index.js"}` + `module.exports={}`), write throwaway `scripts/_alert-check.ts` that: (a) with no `ALERT_WEBHOOK_URL`, `await notifyBillingFailure("x", new Error("y"))` resolves (no throw) → log "ok no-url"; (b) `process.env.ALERT_WEBHOOK_URL="http://127.0.0.1:9/nope"; await notifyBillingFailure("x", {a:1})` still resolves (no throw) → log "ok bad-url". Run `npx tsx scripts/_alert-check.ts` (env loaded). Then delete `scripts/_alert-check.ts` + the shim. Then `npm run build` → green.
- [ ] **Step 5: Commit** `git add src/lib/alert.ts src/app/api/turn src/app/api/billing/webhook .env.example && git commit -m "feat(billing): alert on chargeTurn/webhook failures via optional webhook"`

---

### Task 2: Usage/billing page

**Files:**
- Create: `src/app/billing/page.tsx`, `src/app/billing/TopUpButton.tsx`
- Modify: `src/app/chat/ChatClient.tsx`

**Interfaces — Consumes:** `requireUserId` (`@/lib/current-user`); `prisma` (`@/lib/prisma`); `TopUpModal` (`../chat/TopUpModal`). Data shapes: `Wallet { balanceMicros, lifetimeGrantMicros, lifetimeSpentMicros }`; `UsageEvent { createdAt, route, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, billedMicros, stoppedAt }`; `CreditTransaction { createdAt, kind, amountPaidCents, creditsMicros }`.

- [ ] **Step 1:** Create `src/app/billing/TopUpButton.tsx` — `"use client"`. State `const [open, setOpen] = useState(false)`. Renders a stone/amber button "Top up" that `setOpen(true)`, and `<TopUpModal open={open} reason="Add credits" onClose={() => setOpen(false)} />` (import from `../chat/TopUpModal`).
- [ ] **Step 2:** Create `src/app/billing/page.tsx` — `export const dynamic = "force-dynamic";` async server component. `const userId = await requireUserId();`. Query in parallel via `Promise.all`: `prisma.wallet.findUnique({ where: { studentId: userId } })`, `prisma.usageEvent.findMany({ where: { studentId: userId }, orderBy: { createdAt: "desc" }, take: 50 })`, `prisma.creditTransaction.findMany({ where: { studentId: userId }, orderBy: { createdAt: "desc" }, take: 50 })`. Render mirroring `src/app/ledger/page.tsx` (read it for the container/ThemeToggle/stone-amber/dark-mode layout):
  - Header with a `← Chat` link to `/chat` + `ThemeToggle`.
  - **Balance card:** `` `$${((wallet?.balanceMicros ?? 0)/1e6).toFixed(2)}` `` big; "granted" `lifetimeGrantMicros` and "spent" `lifetimeSpentMicros` small (both `/1e6 .toFixed(2)`); `<TopUpButton />`.
  - **Usage table** (when non-empty): columns Date (`createdAt.toLocaleString()`), Route, Tokens (`in/out`, plus `cache r/w` only if either >0), Cost (`` `$${(billedMicros/1e6).toFixed(2)}` ``), Stopped (`stoppedAt`). Empty-state: "No AI usage yet."
  - **Purchases & credits table** (when non-empty): Date, Kind, Paid (`` `$${(amountPaidCents/100).toFixed(2)}` ``), Credited (`` `$${(creditsMicros/1e6).toFixed(2)}` ``). Empty-state line.
- [ ] **Step 3:** In `src/app/chat/ChatClient.tsx` header, near the balance pill (~line 380), add a small `<a href="/billing" ...>Billing</a>` link (stone, hover amber) next to the existing "Top up" button. Additive only — don't change the pill/Top-up behavior.
- [ ] **Step 4: Verify.** `npm run build` → green; `/billing` present as a route (`ƒ`). Start `npm run dev`; `curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:PORT/billing` → 307 → `/login` (auth-gated). Stop dev. (Signed-in render is eyeballed by the owner.)
- [ ] **Step 5: Commit** `git add src/app/billing src/app/chat/ChatClient.tsx && git commit -m "feat(billing): usage + balance history page (/billing) with top-up"`

---

## Self-Review
- Scope: alerting (T1) + usage page (T2); rate-limiting/minor hardening excluded per user.
- Reuse: `TopUpModal`, `CREDIT_PACKS`, `requireUserId`, the `ledger/page.tsx` layout, `(micros/1e6).toFixed(2)`.
- No new deps, no migration; `ALERT_WEBHOOK_URL` optional (console fallback).
- `notifyBillingFailure(context, detail)` signature identical across the 3 sites.
