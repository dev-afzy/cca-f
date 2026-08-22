# GLM Provider Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a student choose, from a new settings page, whether the AI tutor runs on Anthropic (Claude Sonnet, current behavior) or Z.ai's GLM-5.3 — both backends fronted by the owner's own API keys (no BYOK), both metered against the existing credit wallet.

**Architecture:** GLM-5.3 is reached through Z.ai's Anthropic-compatible Messages API endpoint, so the existing `@anthropic-ai/sdk` client is reused unmodified — only its `baseURL`/`apiKey` change per provider. `src/lib/anthropic.ts` becomes a small per-provider client/model registry instead of one singleton. The student's choice is a new `Student.preferredProvider` column, read once per turn and threaded into `runTutorLoop`. The intent-classification router call stays fixed on Anthropic Haiku always — it's a small, invisible-to-the-student call, and doubling the provider surface there has no user-facing benefit. Prompt caching (`cache_control`) stays on for Anthropic (proven) and is turned OFF by default for GLM until Task 1 empirically confirms Z.ai's endpoint tolerates/benefits from it.

**Tech Stack:** Next.js 16 App Router, `@anthropic-ai/sdk` ^0.96.0 (unchanged — reused for both providers), Prisma 7 + libsql SQLite.

**Spec:** No separate spec/design doc — scope was fixed by one clarifying question in this planning session (recorded below) plus a codebase-coupling audit and Z.ai API research. Both are summarized in Context.

## Context

The user asked to wire in a GLM 5.3 API key and, separately, whether a model could be chosen from a settings page. Two facts made this a real design decision rather than a pure "add a key" task:

1. **This exact app already made a deliberate, opposite-sounding decision.** During the billing build-out, BYOK (bring-your-own-key) was explicitly considered and rejected in favor of the owner fronting one Anthropic key for everyone, metered against a prepaid wallet — specifically to avoid per-user key handling and abuse risk. Adding a second provider could silently reopen that question, so it was asked directly: **the owner is adding a second *owner-held* key (GLM), not letting students bring their own.** Both backends remain metered the same way.
2. **The tutor's actual subject matter is Claude/Claude-Code-specific** (Agent SDK hooks, `stop_reason`, CLAUDE.md hierarchy, MCP as Claude Code implements it, built-in tools). Swapping the *backend that explains this material* doesn't change the material (the question bank is static, hand-authored, stored in the DB either way) — but a competitor model explaining Claude's own APIs is a real quality tradeoff the student is now explicitly opting into via the settings page, not something silently decided for them.

**Codebase audit findings** (informs every task below):
- There is exactly **one** `new Anthropic(...)` call site (`src/lib/anthropic.ts`), no `baseURL` configured (defaults to Anthropic's endpoint), and **no existing provider-abstraction of any kind** anywhere in the repo.
- Model ids are two constants (`MODEL_TUTOR`, `MODEL_ROUTER`) in that one file, cleanly consumed by `src/lib/router.ts` and `src/lib/tutor/loop.ts` — small surface.
- `src/lib/router.ts` makes a plain `.messages.create()` call (no tools, no `cache_control`) — low compatibility risk.
- `src/lib/tutor/loop.ts` makes the risky call: `.messages.stream()` with `tools`, prompt-caching `cache_control` blocks, and explicit branching on `stop_reason` values (`tool_use`/`end_turn`/`stop_sequence`).
- `src/lib/billing/pricing.ts`'s `rawCostMicros` **throws** on an unrecognized model id — but that throw is caught inside the turn route's own try/catch and only logged (`notifyBillingFailure`). **A GLM turn with no matching `PRICES` entry does not error to the user — it silently completes unbilled.** Task 2 must add the GLM row before Task 3 wires it in.
- `src/lib/billing/usage.ts`'s `fromSdkUsage` reads exact Anthropic-shaped field names (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`) and defensively coalesces anything missing to `0` — so a shape mismatch fails silently (zero usage recorded) rather than erroring. Task 1 verifies GLM's usage object actually uses these names before anything is built against it.
- No settings page and no per-student provider/model preference column exist yet — both are net-new.

**Z.ai / GLM-5.3 research** (sourced; re-verify if this plan is executed much later than 2026-08-22):
- Z.ai exposes an Anthropic-compatible Messages API at `https://api.z.ai/api/anthropic`, documented as supporting "the core Anthropic messages API contract including tool use and streaming." ([Z.AI · OpenClaw](https://docs.openclaw.ai/providers/zai))
- Pricing: **$1.40 / million input tokens, $4.40 / million output tokens** ([VentureBeat](https://venturebeat.com/technology/glm-5-3-hits-the-api-at-1-4-4-4-per-million-tokens), corroborated by [OpenRouter](https://openrouter.ai/z-ai/glm-5.3)).
- The model id most consistently used across independent sources (OpenRouter, OpenClaw, CometAPI, Kingy AI) is **`glm-5.3`**. This is the *working* value used below — Task 1's live smoke test is what turns it from "well-sourced" into "confirmed," by reading the exact string Z.ai's own endpoint echoes back in `response.model`.
- **Not found in any source:** confirmation that Z.ai's endpoint honors Anthropic's `cache_control` prompt-caching semantics specifically. Do not assume either way — Task 1 tests it.

## Global Constraints

- **No BYOK.** Both provider keys (`ANTHROPIC_API_KEY`, `GLM_API_KEY`) are the owner's own, set as server env vars. Students never submit a key.
- **The router (intent classification) always uses Anthropic Haiku**, regardless of the student's chosen tutor provider. Do not add a provider parameter to `src/lib/router.ts`.
- **Billing must fail loud, not silent.** Every provider added to `src/lib/anthropic.ts`'s tutor-model registry must have a matching `src/lib/billing/pricing.ts` `PRICES` entry with the *exact* model id string in the same commit that wires the provider into the turn routes. Verify by grep, not by memory.
- **Prompt caching defaults OFF for any unconfirmed provider.** Only enable `cache_control` for a provider once its API has been empirically shown (not assumed) to accept it without erroring.
- **Node ≥ 22 + env for every command:** `export PATH="/Users/afeesudheenp/.nvm/versions/node/v22.17.1/bin:$PATH" && set -a && . ./.env && set +a`. Verify `node -v` = v22 first.
- **Migrations are hand-authored + `prisma migrate deploy`** (never `migrate dev`), backed up first — this repo's real study-progress DB lives at `~/.cca-f-tutor/cca-f.db`.
- `npm run validate:content`, `npm run test:grading`, and `npm run build` must all stay green after every task.

---

### Task 1: GLM connectivity + compatibility smoke test

**Files:**
- Create: `scripts/check-glm-compat.ts` (temporary — deleted at the end of this task once its findings are recorded)
- Create: `docs/superpowers/plans/2026-08-22-glm-compat-findings.md` (the recorded findings later tasks build against)

**Interfaces:** None yet — this task produces facts, not code the app depends on.

This task **requires a real GLM API key** and must be run by whoever holds it (the owner) — it cannot be completed by an agent with no credential. If you are an agentic worker with no GLM key available, stop here and report `NEEDS_CONTEXT: GLM_API_KEY required to complete Task 1`.

- [ ] **Step 1: Write the smoke-test script**

```typescript
// scripts/check-glm-compat.ts
// Verifies Z.ai's Anthropic-compatible endpoint against the two call shapes
// this app actually uses (router.ts's plain create(), loop.ts's streaming
// tool-use + prompt-caching call), using the SAME @anthropic-ai/sdk client
// this app already depends on — no new SDK, just a different baseURL/key.
import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

const apiKey = process.env.GLM_API_KEY;
if (!apiKey) {
  console.error("Set GLM_API_KEY before running this script.");
  process.exit(1);
}

const baseURL = process.env.GLM_BASE_URL ?? "https://api.z.ai/api/anthropic";
const client = new Anthropic({ apiKey, baseURL });
const MODEL = "glm-5.3";

const PROBE_TOOL: Tool = {
  name: "get_weather",
  description: "Get the current weather for a city.",
  input_schema: {
    type: "object",
    properties: { city: { type: "string" } },
    required: ["city"],
  },
};

async function main() {
  console.log(`Target: ${baseURL}  model: ${MODEL}\n`);

  console.log("=== Test 1: plain messages.create() (router.ts shape) ===");
  const r1 = await client.messages.create({
    model: MODEL,
    max_tokens: 30,
    temperature: 0,
    system: "Respond with only the word: pong",
    messages: [{ role: "user", content: "ping" }],
  });
  console.log("model echoed back:", r1.model);
  console.log("stop_reason:", r1.stop_reason);
  console.log("content[0]:", JSON.stringify(r1.content[0]));
  console.log("usage (raw):", JSON.stringify(r1.usage));

  console.log("\n=== Test 2: streaming + tools + cache_control (loop.ts shape) ===");
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 200,
      system: [
        {
          type: "text",
          text: "You are a test harness. When asked for weather, call get_weather.",
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [PROBE_TOOL],
      messages: [{ role: "user", content: "What's the weather in Paris?" }],
    });
    const final = await stream.finalMessage();
    console.log("stop_reason:", final.stop_reason);
    console.log("content blocks:", final.content.map((b) => b.type).join(", "));
    const toolUse = final.content.find((b) => b.type === "tool_use");
    console.log("tool_use block:", toolUse ? JSON.stringify(toolUse) : "(none — check stop_reason above)");
    console.log("usage (raw):", JSON.stringify(final.usage));
    console.log("cache_control accepted without error: YES");
  } catch (e) {
    console.log("cache_control / streaming+tools call FAILED:");
    console.log(e instanceof Error ? e.message : String(e));
  }
}

main().catch((e) => {
  console.error("FATAL:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
```

- [ ] **Step 2: Run it**

```bash
export PATH="/Users/afeesudheenp/.nvm/versions/node/v22.17.1/bin:$PATH"
export GLM_API_KEY="<the real key>"
npx tsx scripts/check-glm-compat.ts
```

- [ ] **Step 3: Record the findings**

Write `docs/superpowers/plans/2026-08-22-glm-compat-findings.md` with the ACTUAL output, answering explicitly:
  - Exact `model` string Z.ai echoes back (Task 2's `PRICES` key and tutor-model registry entry must use this exact string — if it is not `"glm-5.3"`, every later task's code samples that use that literal must be corrected to match).
  - Exact `stop_reason` values seen (confirm `tool_use`/`end_turn` appear as expected — `loop.ts`'s branching depends on these exact strings).
  - Exact `usage` field names present (confirm `input_tokens`/`output_tokens` exist; confirm whether `cache_creation_input_tokens`/`cache_read_input_tokens` are present and non-zero, or absent).
  - Did Test 2 (streaming + tools + `cache_control`) succeed or throw? If it threw, quote the exact error — this decides Task 3's `enablePromptCaching` default for `"glm"`.

- [ ] **Step 4: Delete the throwaway script, keep the findings doc**

```bash
rm scripts/check-glm-compat.ts
git add docs/superpowers/plans/2026-08-22-glm-compat-findings.md
git commit -m "docs(glm): record Z.ai Anthropic-compatible endpoint smoke-test findings"
```

---

### Task 2: Provider registry + GLM pricing entry

**Files:**
- Modify: `src/lib/anthropic.ts` (rewrite — see below)
- Modify: `src/lib/billing/pricing.ts`
- Test: `scripts/check-grading.ts` is unaffected; run it to confirm no regression

**Interfaces:**
- Consumes: Task 1's findings doc for the exact GLM model id string and the confirmed `usage` field shape.
- Produces: `export type TutorProvider = "anthropic" | "glm";`, `export function getTutorClient(provider: TutorProvider): Anthropic`, `export function getTutorModel(provider: TutorProvider): string`, `export const MODEL_ROUTER: string` (unchanged name/value, still consumed by `router.ts` exactly as today), `export const anthropic: Anthropic` (unchanged — the fixed Anthropic client `router.ts` already imports by this name).

Replace all of `src/lib/anthropic.ts`. **If Task 1 found a model id other than `"glm-5.3"`, substitute it below before writing the file.**

- [ ] **Step 1: Rewrite `src/lib/anthropic.ts`**

```typescript
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export type TutorProvider = "anthropic" | "glm";

// The router (intent classification) always uses this, regardless of the
// student's chosen tutor provider — a small, invisible-to-the-student call;
// doubling the provider surface there has no user-facing benefit.
export const MODEL_ROUTER = "claude-haiku-4-5-20251001";

const TUTOR_MODEL_BY_PROVIDER: Record<TutorProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  glm: "glm-5.3", // confirmed against docs/superpowers/plans/2026-08-22-glm-compat-findings.md
};

type ClientConfig = { apiKey: string | undefined; baseURL?: string };

const CLIENT_CONFIG: Record<TutorProvider, ClientConfig> = {
  anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
  glm: {
    apiKey: process.env.GLM_API_KEY,
    baseURL: process.env.GLM_BASE_URL ?? "https://api.z.ai/api/anthropic",
  },
};

declare global {
  // eslint-disable-next-line no-var
  var __tutorClients: Partial<Record<TutorProvider, Anthropic>> | undefined;
}

const clientCache: Partial<Record<TutorProvider, Anthropic>> =
  globalThis.__tutorClients ?? {};

export function getTutorClient(provider: TutorProvider): Anthropic {
  if (!clientCache[provider]) {
    clientCache[provider] = new Anthropic(CLIENT_CONFIG[provider]);
  }
  return clientCache[provider]!;
}

export function getTutorModel(provider: TutorProvider): string {
  return TUTOR_MODEL_BY_PROVIDER[provider];
}

// Kept for router.ts, which is unaffected by any of the above — it always
// wants the plain Anthropic client under this exact import name.
export const anthropic = getTutorClient("anthropic");

if (process.env.NODE_ENV !== "production") {
  globalThis.__tutorClients = clientCache;
}
```

- [ ] **Step 2: Add the GLM row to `src/lib/billing/pricing.ts`'s `PRICES` table**

Insert after the existing `"claude-haiku-4-5-20251001"` entry:

```typescript
  // $1.40 / $4.40 per 1M tokens (in/out) — https://venturebeat.com/technology/glm-5-3-hits-the-api-at-1-4-4-4-per-million-tokens
  // Cache rates are NOT confirmed for Z.ai's endpoint (see
  // docs/superpowers/plans/2026-08-22-glm-compat-findings.md). Defaulting
  // cacheWrite/cacheRead to the base input rate is deliberately conservative:
  // if GLM turns out not to discount cached tokens, this doesn't overbill; if
  // it does and this table is wrong, it undercounts the discount rather than
  // manufacturing one that was never measured. Revisit once confirmed.
  "glm-5.3": {
    in: 1_400_000,
    out: 4_400_000,
    cacheWrite: 1_400_000,
    cacheRead: 1_400_000,
  },
```

If Task 1 found a different model id string, use that exact string as the key here too — it must match `TUTOR_MODEL_BY_PROVIDER.glm` in `anthropic.ts` byte-for-byte, or every GLM turn will hit `rawCostMicros`'s "Unknown model for billing" throw.

- [ ] **Step 3: Verify**

```bash
export PATH="/Users/afeesudheenp/.nvm/versions/node/v22.17.1/bin:$PATH"
set -a && . ./.env && set +a
npm run build   # router.ts's `import { anthropic, MODEL_ROUTER }` must still resolve unchanged
npm run test:grading
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/anthropic.ts src/lib/billing/pricing.ts
git commit -m "feat(billing): GLM-5.3 provider registry + pricing entry"
```

---

### Task 3: Wire the provider choice through the tutor loop, turn routes, and prompt caching

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260822120000_add_student_preferred_provider/migration.sql`
- Modify: `src/lib/tutor/prompt.ts`
- Modify: `src/lib/tutor/loop.ts`
- Modify: `src/app/api/turn/route.ts`
- Modify: `src/app/api/turn/retry/route.ts`

**Interfaces:**
- Consumes: `TutorProvider`, `getTutorClient`, `getTutorModel` from Task 2's `src/lib/anthropic.ts`.
- Produces: `Student.preferredProvider: string` (DB column, values `"anthropic"` | `"glm"`, default `"anthropic"`); `LoopInput.provider?: TutorProvider` (optional, defaults to `"anthropic"` inside `runTutorLoop` — matches the existing optionality style of `LoopInput.iterationCap?: number`); `PromptInput.enablePromptCaching: boolean` (required, no silent default — callers must decide deliberately).

- [ ] **Step 1: Add the column to `prisma/schema.prisma`**

In the `Student` model, add one line after `preferredStyle`:

```prisma
  preferredStyle    String   @default("[]")
  preferredProvider String   @default("anthropic")
```

- [ ] **Step 2: Hand-author the migration**

```sql
-- prisma/migrations/20260822120000_add_student_preferred_provider/migration.sql
ALTER TABLE "Student" ADD COLUMN "preferredProvider" TEXT NOT NULL DEFAULT 'anthropic';
```

- [ ] **Step 3: Thread `enablePromptCaching` through `src/lib/tutor/prompt.ts`**

Read the current `buildPrompt` first — it builds a `system: TextBlockParam[]` with one block carrying `cache_control: { type: "ephemeral" }`, and a first user message with 3 content blocks where 2 carry the same marker. Add a helper and a required field to `PromptInput`:

```typescript
type CacheMarker = { cache_control: { type: "ephemeral" } } | Record<string, never>;

function maybeCache(enabled: boolean): CacheMarker {
  return enabled ? { cache_control: { type: "ephemeral" } } : {};
}
```

Add `enablePromptCaching: boolean` to `PromptInput`. Everywhere the existing code writes a literal `cache_control: { type: "ephemeral" },` on a block, replace it with `...maybeCache(input.enablePromptCaching),` (spread, so the field is entirely absent — not present-with-a-falsy-value — when disabled).

- [ ] **Step 4: Resolve the provider at the top of `runTutorLoop` in `src/lib/tutor/loop.ts`**

Change the import line from:
```typescript
import { anthropic, MODEL_TUTOR } from "@/lib/anthropic";
```
to:
```typescript
import { getTutorClient, getTutorModel, type TutorProvider } from "@/lib/anthropic";
```

Add `provider?: TutorProvider;` to `LoopInput`. At the top of `runTutorLoop`, before the loop:
```typescript
const provider: TutorProvider = input.provider ?? "anthropic";
const client = getTutorClient(provider);
const model = getTutorModel(provider);
```

Replace the `buildPrompt({...})` call's arguments to add `enablePromptCaching: provider === "anthropic"` (the confirmed-safe default from Global Constraints — flip this expression to `true` for both providers only once Task 1's findings confirm GLM tolerates `cache_control`, and note that change in the commit message).

Replace every `anthropic.messages.stream({ model: MODEL_TUTOR, ... })` call with `client.messages.stream({ model, ... })` (one call site). Replace every `model: MODEL_TUTOR` field inside the three `LoopResult`-returning statements with `model` (the resolved local variable) — these are the values `chargeTurn`'s `perModel` array uses for billing, so this is exactly what makes Task 2's pricing row actually get used.

- [ ] **Step 5: Pass the student's stored choice from both turn routes**

In `src/app/api/turn/route.ts` and `src/app/api/turn/retry/route.ts`, both already load `student` via `prisma.student.findUnique(...)` before calling `runTutorLoop`. Add `preferredProvider: true` to that query's `select`, and add `provider: student.preferredProvider as "anthropic" | "glm"` to the object passed into `runTutorLoop`.

- [ ] **Step 6: Verify — do NOT run migrate deploy yet (Task 5 does, with a backup)**

```bash
export PATH="/Users/afeesudheenp/.nvm/versions/node/v22.17.1/bin:$PATH"
set -a && . ./.env && set +a
npx prisma generate
npm run build
npm run test:grading
```

- [ ] **Step 7: Commit**

```bash
git add prisma src/lib/tutor/prompt.ts src/lib/tutor/loop.ts src/app/api/turn
git commit -m "feat(tutor): thread preferredProvider through the loop + turn routes; gate prompt caching per provider"
```

---

### Task 4: Settings page

**Files:**
- Create: `src/app/settings/page.tsx`
- Create: `src/app/settings/ProviderPicker.tsx`
- Create: `src/app/api/settings/provider/route.ts`
- Modify: `src/app/chat/ChatClient.tsx` (add a nav link, additive only)

**Interfaces:**
- Consumes: `requireUserId` (`@/lib/current-user`) for the page, `requireUserIdApi` for the route — the exact same pair `/billing`'s page/route pair already uses.

- [ ] **Step 1: `src/app/api/settings/provider/route.ts`**

```typescript
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserIdApi } from "@/lib/current-user";

const KNOWN_PROVIDERS = new Set(["anthropic", "glm"]);

export async function POST(req: Request) {
  const userId = await requireUserIdApi();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { provider } = (await req.json().catch(() => ({}))) as { provider?: string };
  if (typeof provider !== "string" || !KNOWN_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  await prisma.student.update({
    where: { id: userId },
    data: { preferredProvider: provider },
  });

  return NextResponse.json({ ok: true, provider });
}
```

- [ ] **Step 2: `src/app/settings/ProviderPicker.tsx`** (client component)

```typescript
"use client";

import { useState } from "react";

const PROVIDERS = [
  { id: "anthropic", label: "Claude (Sonnet)", note: "The model this curriculum is built and tested against." },
  { id: "glm", label: "GLM-5.3", note: "A separate model explaining the same Claude-specific material — answers may differ from Claude's own." },
] as const;

export default function ProviderPicker({ initialProvider }: { initialProvider: string }) {
  const [selected, setSelected] = useState(initialProvider);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (provider: string) => {
    if (provider === selected || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setSelected(provider);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          onClick={() => void choose(p.id)}
          disabled={saving}
          className={`text-left rounded-xl border p-4 transition-colors disabled:opacity-50 ${
            selected === p.id
              ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
              : "border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-900"
          }`}
        >
          <div className="font-medium text-sm text-stone-800 dark:text-stone-100">{p.label}</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">{p.note}</div>
        </button>
      ))}
      {error && <span className="text-[11px] text-rose-500">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 3: `src/app/settings/page.tsx`** (server component — mirror `src/app/billing/page.tsx`'s layout: container, `ThemeToggle`, back link)

```typescript
export const dynamic = "force-dynamic";

import Link from "next/link";
import ThemeToggle from "../ThemeToggle";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/current-user";
import ProviderPicker from "./ProviderPicker";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const student = await prisma.student.findUnique({
    where: { id: userId },
    select: { preferredProvider: true },
  });

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <Link href="/chat" className="text-sm text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400">
            ← Chat
          </Link>
          <ThemeToggle />
        </div>
        <h1 className="text-xl font-semibold mb-1">Tutor model</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
          Choose which model runs your tutoring conversations. This does not change the curriculum
          or question bank — both are fixed content, answered by whichever model you pick here.
        </p>
        <ProviderPicker initialProvider={student?.preferredProvider ?? "anthropic"} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Add a nav link** — in `src/app/chat/ChatClient.tsx`, find the existing `/billing` link in the header (added when the usage page was built) and add a `<Link href="/settings">Settings</Link>` right beside it, matching its exact classes. Additive only — do not touch the balance pill, the paywall modal, or any existing behavior.

- [ ] **Step 5: Verify**

```bash
export PATH="/Users/afeesudheenp/.nvm/versions/node/v22.17.1/bin:$PATH"
set -a && . ./.env && set +a
npm run build   # confirm /settings and /api/settings/provider appear as routes
```

- [ ] **Step 6: Commit**

```bash
git add src/app/settings src/app/api/settings src/app/chat/ChatClient.tsx
git commit -m "feat(settings): tutor-model picker page (Claude vs GLM-5.3)"
```

---

### Task 5: Migrate, env docs, and end-to-end verify

**Files:** `.env.example`, `docs/DEPLOY.md`, `docs/BACKLOG.md` (operational otherwise)

- [ ] **Step 1: Env docs.** In `.env.example`, right after the existing `ANTHROPIC_API_KEY` line, add:
```
# GLM-5.3 (Z.ai) — optional second tutor backend, owner-held key (no BYOK).
# Get a key at https://z.ai. The Anthropic-compatible endpoint is used, so no
# separate SDK is needed — see src/lib/anthropic.ts.
GLM_API_KEY=
GLM_BASE_URL=https://api.z.ai/api/anthropic
```
Add a row to the env table in `docs/DEPLOY.md`: `GLM_API_KEY` / `GLM_BASE_URL` — "optional; enables the GLM-5.3 tutor option on the settings page. Leave blank to offer Claude only — the settings page should still degrade sensibly (see Step 4)."

- [ ] **Step 2: Backup + migrate.**
```bash
cp ~/.cca-f-tutor/cca-f.db ~/.cca-f-tutor/cca-f.db.bak-glm-$(date +%Y%m%d-%H%M%S)
export PATH="/Users/afeesudheenp/.nvm/versions/node/v22.17.1/bin:$PATH"
set -a && . ./.env && set +a
npx prisma migrate deploy
```
Verify every existing student's `preferredProvider` defaulted to `"anthropic"` and no other column changed.

- [ ] **Step 3: Live turn test against GLM** (requires `GLM_API_KEY` set in `.env`). Set your own account's `preferredProvider` to `"glm"` via the new settings page (or directly via `npx tsx -e "..."` against the DB), send one real chat message, and confirm: the reply streams normally; the `UsageEvent` row created for that turn has `modelBreakdown` containing the GLM model id; `billedMicros` is non-zero (proves Task 2's pricing row is actually being hit, not silently skipped). Then set it back to `"anthropic"` and confirm a turn still works exactly as before — this is the regression check that matters most, since Task 3 touched the one code path every existing turn goes through.

- [ ] **Step 4: Handle the no-GLM-key case explicitly.** If `GLM_API_KEY` is unset, `getTutorClient("glm")` still constructs an `Anthropic` client (with `apiKey: undefined`), and the first real GLM API call will fail with an SDK-level auth error inside `runTutorLoop`'s try/catch in the turn route — which surfaces as a generic `{ type: "error" }` event to the chat UI, not a helpful message. Decide and implement one of: (a) hide the GLM option on the settings page entirely when the server has no `GLM_API_KEY` (check via a tiny server action or by passing an `glmAvailable` boolean from the page to `ProviderPicker`), or (b) leave it visible but let the existing generic error path handle it. Recommendation: (a) — cheap (one boolean, computed server-side from `Boolean(process.env.GLM_API_KEY)`, in `src/app/settings/page.tsx`, passed to `ProviderPicker` to disable/hide the GLM card) and avoids a confusing dead-end for any student who picks an option the owner never configured.

- [ ] **Step 5: Final gates.**
```bash
npm run validate:content
npm run test:grading
npm run build
git status --short   # only .env.example / docs/DEPLOY.md should be uncommitted-then-committed here
```

- [ ] **Step 6: Commit**
```bash
git add .env.example docs/DEPLOY.md
git commit -m "chore(glm): env docs + Task 5 migrate/verify"
```

---

## Self-Review

**Spec coverage:** the one clarifying decision (owner-held second key, no BYOK) → Tasks 2–4 build exactly that, nothing more. "Choose the model in settings page" → Task 4. "What changes need to be made in the app" → this entire plan, with Task 1 turning the one genuinely unverified fact (Z.ai compatibility depth) into a recorded finding before any code depends on it.

**Placeholder scan:** the one value that isn't yet 100%-confirmed (`"glm-5.3"` as the exact model id, and the cache pricing rates) is flagged as a *sourced, working value with an explicit correction step* (Task 1's findings doc, cross-checked in Task 2), not a bare TBD — consistent with how this same project has always treated externally-sourced facts it can't verify offline (see `docs/BACKLOG.md`'s exam-guide research).

**Type consistency:** `TutorProvider` is defined once in Task 2 (`src/lib/anthropic.ts`) and reused by name in `LoopInput.provider` (Task 3), the turn routes' cast (Task 3), and nowhere else redefined. `getTutorClient`/`getTutorModel` signatures match their Task 3 call sites exactly. `PromptInput.enablePromptCaching` is introduced and consumed within the same task (3), so no cross-task drift risk.

**Explicitly out of scope (not requested, not built):** per-turn model switching mid-conversation (the choice is read once per turn from the stored preference, same pattern as `preferredStyle`); a separate markup/pricing config for GLM beyond the one `PRICES` row (reuses the existing `CCAF_MARKUP` multiplier — GLM's raw cost is already far below Sonnet's, so this needs no separate tuning yet); making the router provider-switchable (explicitly rejected in Global Constraints); BYOK for either provider (explicitly rejected in Context).
