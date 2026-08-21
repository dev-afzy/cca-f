# Billing Phase 2 Implementation Plan — Stripe Top-ups + Paywall UX

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Let users buy prepaid credit packs via Stripe Checkout to refill their wallet, and turn the Phase-1 402 (out-of-credits) into a friendly top-up paywall. Builds on Phase 1 (metering + wallet + `grantCredits`).

**Architecture:** Stripe Checkout (hosted, one-time `mode:"payment"`) with **inline `price_data`** keyed off a `packs.ts` table (no Stripe dashboard product setup needed). A webhook grants credits idempotently via the existing `grantCredits`. The chat UI shows a balance pill and opens a top-up modal on 402. Additive; live Stripe verification is deferred to the user (their keys).

**Tech Stack:** Next.js 16 App Router, Prisma 7 + libsql SQLite, `stripe` ^22 (installed), Auth.js v5.

## Global Constraints

- **Node ≥ 22** for every command: `export PATH="/Users/afeesudheenp/.nvm/versions/node/v22.17.1/bin:$PATH"` then build; verify `node -v` = v22. Do NOT use `nvm use`.
- **Money = integer micro-dollars** ($1 = 1_000_000 µ$). Stripe `unit_amount` is in **cents**. A pack maps `priceCents` (Stripe) ↔ `creditsMicros` (wallet). Markup/profit is already applied at metering (Phase 1 `chargeTurn`), so packs are face-value: `$5 → priceCents 500 → creditsMicros 5_000_000`.
- **Reuse Phase 1:** `grantCredits(...)` from `@/lib/billing/wallet` (idempotent on `stripeSessionId`/`stripeEventId`/`idempotencyKey`; the DB has unique indexes on all three), `getBalanceMicros`. Do NOT reimplement crediting.
- **Singleton pattern** for the Stripe client mirrors `src/lib/anthropic.ts`/`src/lib/prisma.ts` (+ `import "server-only"`).
- **Webhook MUST use the raw request body** (`await req.text()`) for signature verification — never `req.json()` first. `export const runtime = "nodejs"` on both new routes.
- **Migrations hand-authored + `prisma migrate deploy`** (matching Phase 1) — never `migrate dev`. Deploy happens in the final task with a DB backup.
- Packs default to `$5 / $15 / $50` (1:1 dollar→credit); these are owner-tunable in `packs.ts`.
- Live Stripe testing needs the user's `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + Stripe CLI — deferred to the user (like OAuth). Tasks build + compile/unit-verify only.

---

### Task 1: Stripe client + packs + customer-id schema

**Files:**
- Create: `src/lib/stripe.ts`, `src/lib/billing/packs.ts`
- Modify: `prisma/schema.prisma` (add `User.stripeCustomerId String? @unique`)
- Create: `prisma/migrations/20260628160000_add_stripe_customer/migration.sql`

**`src/lib/stripe.ts`** (`import "server-only"`): singleton `stripe` from `new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: <the SDK's pinned default — omit the field to use the SDK default if unsure> })`, cached on `globalThis` like `anthropic.ts`. Export `stripe`.

**`src/lib/billing/packs.ts`** (pure, NO server-only): 
```ts
export type CreditPack = { id: string; label: string; priceCents: number; creditsMicros: number };
export const CREDIT_PACKS: CreditPack[] = [
  { id: "p5",  label: "$5",  priceCents: 500,  creditsMicros: 5_000_000 },
  { id: "p15", label: "$15", priceCents: 1500, creditsMicros: 15_000_000 },
  { id: "p50", label: "$50", priceCents: 5000, creditsMicros: 50_000_000 },
];
export function getPack(id: string): CreditPack | undefined { return CREDIT_PACKS.find(p => p.id === id); }
```

**Schema:** add `stripeCustomerId String? @unique` to the existing `User` model. Hand-author the migration (`ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;` + `CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");` — match the SQLite style of `prisma/migrations/20260628140000_add_billing/migration.sql`).

- [ ] **Step 1:** Create both lib files + schema change + migration SQL.
- [ ] **Step 2:** `export PATH=... && npx prisma generate && npm run build` → green. **No migrate deploy** (final task).
- [ ] **Step 3: Commit** `git add src/lib/stripe.ts src/lib/billing/packs.ts prisma && git commit -m "feat(billing): stripe client + credit packs + User.stripeCustomerId"`

---

### Task 2: Checkout route

**Files:** Create `src/app/api/billing/checkout/route.ts`

**Interfaces:** Consumes `requireUserIdApi` (`@/lib/current-user`), `stripe` (`@/lib/stripe`), `getPack`/`CREDIT_PACKS` (`@/lib/billing/packs`), `prisma` (`@/lib/prisma`).

`export const runtime = "nodejs";` `POST(req)`:
1. `const userId = await requireUserIdApi();` → 401 if null (same JSON 401 shape as other routes).
2. Parse `{ packId }` from body; `const pack = getPack(packId)`; 400 if missing.
3. Load the `User` (`prisma.user.findUnique({where:{id:userId}})`); ensure a Stripe customer: if `user.stripeCustomerId` is null, `stripe.customers.create({ email: user.email ?? undefined, metadata: { userId } })`, then persist `prisma.user.update({where:{id:userId}, data:{stripeCustomerId: customer.id}})`.
4. Create a Checkout Session:
   ```ts
   const origin = req.headers.get("origin") ?? process.env.AUTH_URL ?? "http://localhost:3000";
   const session = await stripe.checkout.sessions.create({
     mode: "payment",
     customer: stripeCustomerId,
     client_reference_id: userId,
     line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: pack.priceCents, product_data: { name: `CCA-F Tutor credits — ${pack.label}` } } }],
     metadata: { userId, packId: pack.id, creditsMicros: String(pack.creditsMicros) },
     payment_intent_data: { metadata: { userId, packId: pack.id, creditsMicros: String(pack.creditsMicros) } },
     success_url: `${origin}/chat?topup=success`,
     cancel_url: `${origin}/chat?topup=cancel`,
   });
   ```
5. Return `{ url: session.url }` (JSON).

- [ ] **Step 1:** Write the route.
- [ ] **Step 2:** `export PATH=... && npm run build` → green; `/api/billing/checkout` appears as a route.
- [ ] **Step 3: Commit** `git add src/app/api/billing/checkout && git commit -m "feat(billing): stripe checkout session for credit packs"`

---

### Task 3: Webhook route + grantCredits hardening

**Files:**
- Create: `src/app/api/billing/webhook/route.ts`
- Modify: `src/lib/billing/wallet.ts` (`grantCredits` — catch P2002 as already-applied)

**Webhook** `export const runtime = "nodejs";` `POST(req)`:
1. `const raw = await req.text();` (raw body — do NOT `req.json()`). `const sig = req.headers.get("stripe-signature");`
2. `const event = stripe.webhooks.constructEvent(raw, sig!, process.env.STRIPE_WEBHOOK_SECRET ?? "");` inside try/catch → on failure return `new Response("invalid signature", { status: 400 })`.
3. If `event.type === "checkout.session.completed"`: `const s = event.data.object` (a `Stripe.Checkout.Session`); read `userId = s.metadata?.userId ?? s.client_reference_id`, `creditsMicros = Number(s.metadata?.creditsMicros)`, guard both present/valid. Call:
   ```ts
   await grantCredits({ userId, creditsMicros, kind: "purchase", amountPaidCents: s.amount_total ?? 0, stripeSessionId: s.id, stripeEventId: event.id });
   ```
4. Return `new Response("ok", { status: 200 })` for handled + ignored event types (so Stripe doesn't retry). Any thrown error in handling → 500 (Stripe retries) EXCEPT signature failure (400).

**`grantCredits` hardening** (`src/lib/billing/wallet.ts`): wrap the credit `$transaction` so a `Prisma.PrismaClientKnownRequestError` with code `P2002` (unique violation on `stripeSessionId`/`stripeEventId`/`idempotencyKey` from a concurrent duplicate delivery that passed the pre-check) is caught and returns `{ balanceMicros: <re-read current>, alreadyApplied: true }` instead of throwing. Keep the existing pre-`findFirst` idempotency check; this just closes the TOCTOU window using the DB unique indexes as the hard backstop.

- [ ] **Step 1:** Write the webhook; harden `grantCredits`.
- [ ] **Step 2:** `export PATH=... && npm run build` → green; `/api/billing/webhook` appears as a route.
- [ ] **Step 3: Commit** `git add src/app/api/billing/webhook src/lib/billing/wallet.ts && git commit -m "feat(billing): stripe webhook grants credits idempotently"`

---

### Task 4: Paywall UX — balance pill + top-up modal

**Files:**
- Create: `src/app/chat/TopUpModal.tsx`
- Modify: `src/app/chat/page.tsx`, `src/app/chat/ChatClient.tsx`

**`chat/page.tsx`** (server): import `getBalanceMicros` (`@/lib/billing/wallet`); after `requireUserId()` returns `userId`, `const balanceMicros = await getBalanceMicros(userId);` and pass `initialBalanceMicros={balanceMicros}` to `<ChatClient ... />`.

**`TopUpModal.tsx`** (`"use client"`): props `{ open: boolean; onClose: () => void; reason?: string }`. Renders the `CREDIT_PACKS` (import from `@/lib/billing/packs` — pure, safe on client) as buttons; clicking a pack POSTs `{ packId }` to `/api/billing/checkout` and on `{ url }` does `window.location.href = url`. Style with the existing stone/amber Tailwind palette + dark mode (match the app). Show `reason` text (e.g. "You're out of credits" / "Daily limit reached").

**`ChatClient.tsx`** (client):
- Add prop `initialBalanceMicros: number` to `ChatClientProps` (line ~71) and the destructure (line ~84).
- `const [balanceMicros, setBalanceMicros] = useState(initialBalanceMicros);` and `const [topUp, setTopUp] = useState<{open:boolean; reason?:string}>({open:false});`
- In the header (line ~324, next to "Hour {currentHour} / 23"): render a small balance pill showing `$${(balanceMicros/1e6).toFixed(2)}` with a "Top up" button that opens the modal (`setTopUp({open:true})`).
- In the `done` handler (line ~166-191): if `event.balanceMicros` is a number, `setBalanceMicros(event.balanceMicros)`.
- In BOTH fetch error paths (turn ~220 and retry ~279): branch on `res.status === 402` (out of credits) and `=== 429` (daily cap) → open the modal with a friendly `reason` and a clean (non-red-banner) inline notice INSTEAD of throwing the raw `insufficient_credits`/`daily_cap` string; other statuses keep the existing throw→banner behavior. (Read the exact error/optimistic-bubble cleanup at lines 220-233/278-290 and preserve it.)
- Render `<TopUpModal open={topUp.open} reason={topUp.reason} onClose={()=>setTopUp({open:false})} />`.

- [ ] **Step 1:** Read ChatClient fully; make the page + ChatClient + modal changes.
- [ ] **Step 2:** `export PATH=... && npm run build` → green.
- [ ] **Step 3: Commit** `git add src/app/chat && git commit -m "feat(billing): balance pill + top-up modal (402/429 paywall)"`

---

### Task 5: Env, migrate, build/verify

**Files:** `.env.example` (operational otherwise)

- [ ] **Step 1: Env.** Append to `.env.example` (documented, blank): `STRIPE_SECRET_KEY=`, `STRIPE_WEBHOOK_SECRET=` with comments pointing to the Stripe dashboard (API keys) and the Stripe CLI (`stripe listen --forward-to localhost:3000/api/billing/webhook` prints the signing secret for local dev) + the live webhook endpoint `/api/billing/webhook` for `checkout.session.completed`.
- [ ] **Step 2: Migrate.** `cp ~/.cca-f-tutor/cca-f.db ~/.cca-f-tutor/cca-f.db.bak-stripe-$(date +%Y%m%d-%H%M%S)` then `export PATH=... && npx prisma migrate deploy` → applies `add_stripe_customer`. Verify `User.stripeCustomerId` column exists and existing data intact.
- [ ] **Step 3: Static verify (no live Stripe).** `npm run build` green; confirm `/api/billing/checkout` + `/api/billing/webhook` routes present (`ƒ`). Confirm webhook signature rejection path returns 400 on a bad/missing signature (a tiny harness POSTing a fake body to `constructEvent` should throw → 400; or assert via code read). Confirm `getPack`/pack math: `creditsMicros` matches `priceCents*10000` for each pack (1:1 dollar→credit). Do NOT attempt a real charge.
- [ ] **Step 4: Document the live-test steps** for the user in the report: add Stripe keys to `.env`, run `stripe listen`, buy a pack with test card `4242 4242 4242 4242`, confirm a `purchase` CreditTransaction + balance bump.
- [ ] **Step 5: Commit** `git add .env.example && git commit -m "chore(billing): stripe env docs + phase 2 migrate/verify"`

---

## Self-Review (plan-time)
- **Coverage:** stripe client/packs/customer-id → T1; checkout → T2; webhook + idempotency hardening → T3; paywall UX → T4; env/migrate/verify → T5.
- **Build coherence:** each task builds independently; T4's ChatClient prop addition is additive (page passes it in the same task).
- **Reuse:** `grantCredits`/`getBalanceMicros` (Phase 1) are the only crediting/balance paths; packs.ts is the single source of pack truth shared by checkout (server) + modal (client).
- **Safety:** webhook raw-body + signature verify; idempotent credit backed by DB unique indexes; no secret reaches the client (packs.ts has no secrets; Stripe secret only in server routes).
- **Deferred:** live Stripe charge/webhook verification needs the user's keys + Stripe CLI (documented in T5), mirroring the OAuth deferral.
