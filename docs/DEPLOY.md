# Deploy checklist — Vercel + Turso

The app is multi-user (OAuth), metered (per-token billing on the AI tutor), and
Stripe-paid. Content is free; only `/api/turn` costs money. This is the full
go-live checklist. Local dev keeps working with none of this set (SQLite file
fallback).

## 1. Database — Turso (hosted libsql)

The libsql adapter is env-driven: set `TURSO_DATABASE_URL` (+ `TURSO_AUTH_TOKEN`)
and the app uses Turso; leave them blank and it uses the local SQLite file.

```bash
# install the CLI: https://docs.turso.tech/cli/installation
turso db create cca-f
turso db show --url cca-f          # -> libsql://...  (TURSO_DATABASE_URL)
turso db tokens create cca-f       # -> the TURSO_AUTH_TOKEN
```

**Apply migrations to Turso** (reliable path — `prisma migrate deploy` against
remote libsql has known friction, so apply the SQL directly):

```bash
for d in prisma/migrations/*/; do
  echo "applying $d"; turso db shell cca-f < "$d/migration.sql"
done
# then seed the GLOBAL content (concepts + questions only — no Student):
#   set TURSO_DATABASE_URL/TOKEN locally and run: npx tsx prisma/seed.ts
```

Do **not** upload your local dev DB — it contains your personal student row.
A fresh user's Student + trial wallet is created on first login.

## 2. Environment variables (set all in Vercel → Project → Settings → Env)

| Var | Notes |
|---|---|
| `ANTHROPIC_API_KEY` | server-side; powers the tutor. Set Anthropic spend alerts. |
| `GLM_API_KEY` / `GLM_BASE_URL` | optional; enables the GLM-5.3 tutor option on the settings page. Leave blank to offer Claude only — the settings page disables the GLM option when unset (shown with a reason) (see `glmAvailable` in `src/app/settings/page.tsx`). |
| `AUTH_SECRET` | `npx auth secret` (fresh value for prod) |
| `AUTH_URL` | your prod origin, e.g. `https://cca-f.example.com` (no trailing slash) |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth app (prod callback below) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client (prod redirect below) |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | from step 1 |
| `STRIPE_SECRET_KEY` | live key for real payments (test key for staging) |
| `STRIPE_WEBHOOK_SECRET` | from the prod webhook endpoint (step 4) |
| `CCAF_MARKUP` | profit multiplier over raw token cost (default 1.6) |
| `CCAF_TRIAL_MICROS` | free trial credit, µ$ (default 250000 = $0.25) |
| `CCAF_KILL_SWITCH` | `on` to pause all AI turns (503) without a deploy |
| `CCAF_DAILY_USER_CAP_MICROS` / `CCAF_GLOBAL_DAILY_CAP_MICROS` | spend guardrails |
| `CCAF_LEDGER_FILE` | leave unset — the markdown export is auto-skipped on Vercel |

## 3. OAuth — add production callback URLs

- **GitHub** (https://github.com/settings/developers): add callback
  `https://<prod-domain>/api/auth/callback/github` (add a separate prod OAuth app or a second callback).
- **Google** (Cloud Console → Credentials): add authorized redirect
  `https://<prod-domain>/api/auth/callback/google`, and **publish** the OAuth
  consent screen (Testing mode only lets allow-listed users sign in).

## 4. Stripe — production webhook

- Dashboard → Developers → Webhooks → add endpoint
  `https://<prod-domain>/api/billing/webhook`, event `checkout.session.completed`.
- Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
- The webhook only credits when `payment_status === "paid"` and is idempotent.

## 5. Abuse / cost controls (already wired)

- Per-turn pre-flight gate: kill-switch (503), out-of-credits (402), global
  daily cap (503), per-user daily cap (429) — all before any Anthropic call.
- `maxDuration = 60` on the streaming turn routes. **Vercel Hobby caps function
  duration at 60s** — a long agentic loop will be killed at exactly that ceiling.
  Upgrade to Pro (up to 300s) if turns regularly approach 60s.
- Consider adding Upstash rate-limiting (Phase 3 punch list) for a broad public launch.

## 6. Smoke test after deploy

1. Visit `/` logged out → public landing with Sign in.
2. Sign in → claim/create student, $0.25 trial wallet, balance pill shows.
3. Send a chat turn → reply streams; balance pill drops; a `UsageEvent` row appears in Turso.
4. Spend to $0 → next turn opens the top-up modal (402).
5. Buy a pack with a Stripe test card `4242 4242 4242 4242` → balance jumps; one `purchase` CreditTransaction.
6. Set `CCAF_KILL_SWITCH=on` → turns return 503. Unset to resume.

## Known follow-ups (Phase 3)

- Prompt caching on the tutor system prompt for wider margin.
- Alert on `[billing] chargeTurn failed` / `[billing/webhook]` logs.
- Reconcile credited amount against the pack (defense-in-depth).
- Upstash rate-limiting; usage/billing history page.
