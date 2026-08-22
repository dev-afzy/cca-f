# Backlog

Deferred work, most valuable first. Each item states *why*, the *blast radius*, and enough
detail to act on without re-deriving the research.

---

## 1. Scope a "Claude Certified Architect – Professional" (CCAR-P) track

**Why:** Anthropic added three certifications on **23 July 2026**; Professional ($175, exam code
**CCAR-P**, v1.0 July 2026) is a **different exam, not a deeper Foundations** — 7 domains, zero
name overlap with Foundations' 5, no scenario pool, 63 items / 120 min / 720 pass. There is **no
prerequisite and no auto-upgrade** from Foundations.

**The 7 domains (verbatim, with weights):**

| # | Domain | Weight |
|---|---|---|
| 1 | Solution Design & Architecture | 17% |
| 2 | Claude Models, Prompting & Context Engineering | 13% |
| 3 | Integration | 19% |
| 4 | Evaluation, Testing & Optimization | 16% |
| 5 | Governance, Safety & Risk Management | 14% |
| 6 | Stakeholder Communication & Lifecycle Management | 14% |
| 7 | Developer Productivity & Operational Enablement | 7% |

**Head start — the 7 concepts we retired for Foundations are Professional content.** Recover them
from git (`git show 00194ca`, `git show c3c45c4`) rather than rewriting:

| Retired concept | Maps to Professional objective |
|---|---|
| `prompt-caching` | D2 — *"prompt reuse strategies (caching, modular prompts, Skills)"* |
| `token-mechanics-cost` | D2 *"manage token usage"* + D4 *"optimize token usage, latency, cost"* |
| `data-privacy-pii` | D5 *"compliance (GDPR, HIPAA, FedRAMP)"* |
| `stateful-tools-security` | D3 *"authentication and authorization… security gaps"* |
| `prompt-injection` | D5 *"risks, limitations, failure modes"* |
| `error-handling-resp` | D4 *"diagnose system issues"* |
| `agent-pattern-router` | D1 *"select architectural patterns (workflow, agentic, augmented LLM)"* |

**Estimated existing coverage ≈ 1/3** (pass bar is 72%). Strongest: Developer Productivity ~85%
(all of our Week 3). Weakest: **Stakeholder Comms & Lifecycle ~0%** (14% of the exam — structured
discovery, requirement gathering, communicating trade-offs, SLAs, architecture docs, handoff).

**Net-new content required:** RAG pipeline design (chunking/indexing/retrieval strategy) ·
evaluation frameworks + A/B testing + eval datasets · observability & monitoring at scale ·
auth/authz gap analysis · GDPR/HIPAA/FedRAMP · ethical AI (bias/fairness/transparency) ·
business-value pillars · chain-of-thought · agent-to-agent protocols ·
workflow-vs-agentic-vs-augmented-LLM pattern selection.

**Blast radius if built:** the app is currently single-track — `HOUR_TOPICS`, `CONCEPT_SEED`,
`DOMAIN_LABELS`, `EXAM_DOMAIN_WEIGHTS`, `validate-content.ts` and `state-template.md` all assume
**one** curriculum with 5 domains and 24 hours. A second track needs a track discriminator through
all of those (or a separate seed namespace). Non-trivial — scope before building.

**Prerequisite:** pass Foundations first. Professional's MQC profile assumes **3+ yrs systems
architecture/platform engineering + 6+ months hands-on**.

**Source:** [CCAR-P Exam Guide (PDF)](https://everpath-course-content.s3-accelerate.amazonaws.com/instructor/6nizmqk8tpzpfjvt6qmmav7rh/public/1783542810/Claude+Certified+Architect+%E2%80%93+Professional+Exam+Guide.pdf)

---

## 2. ✅ DONE (2026-08-21) — multiple-response support shipped

**Resolved 2026-08-20** by extracting §3 of the v1.0 Foundations guide. Verbatim:

> **Item format** — Multiple-choice **and multiple-response** items; *each item states how many
> responses to select*

This **contradicts v0.1** (*"one correct response and three incorrect responses (distractors)"*) and
confirms the partner FAQ — so item format **did** change between versions, and it is the one
substantive content change the domain/task-statement diff could not see.

**Impact:** our schema is single-answer only — `Question.correctKey` is one letter,
`ExamAnswer.chosenKey` is one letter, `gradeAnswer` compares single letters. All 153 questions and
both 60-question mocks train the wrong format. A candidate practising only single-answer items is
unprepared for "select all that apply"-style items, where partial knowledge scores zero.

**Shipped:** schema (`responseCount`/`correctKeys`/`chosenKeys`, migration applied) · exact-set grading via `gradeAnswerSet` with per-key permutation translation · `npm run test:grading` (27 cases) · checkbox UI with "Select N" gating · 10 items across all five domains (~4.6 surface per 60-question mock) · `fetch_question` guarded to single-answer. Original plan below, for reference:
1. `prisma/schema.prisma` — `Question.correctKeys String` (JSON array) or a `responseCount Int`;
   `ExamAnswer.chosenKeys`. Additive migration + keep single-answer as the 1-element case.
2. `src/lib/exam/score.ts` / `gradeAnswer` — exact-set match (no partial credit unless confirmed).
3. `src/app/exam/[attemptId]/ExamRunner.tsx` — checkbox mode when `responseCount > 1`, and surface
   *"select N"* per the guide's wording.
4. `src/lib/question-seed.ts` — author multiple-response items; `scripts/validate-content.ts` gains a
   check that `correctKeys.length === responseCount`.
5. `.claude/skills/question-bank.md` — add the format to the authoring rubric.

**Also newly published in §3:** result reporting is *"Pass/fail with scaled score (100–1,000), plus
**percent-correct by domain** on the score report"* — our per-domain readout already matches.


### 2b. Follow-up — options are capped at four (A–D), so "select 3" is weak

`Question.options` is a JSON `{A,B,C,D}` object and the validator/UI assume exactly A–D. With four
options a `responseCount: 3` item leaves only **one** wrong answer, which is close to free marks — so
all 10 authored items use `responseCount: 2` (two correct, two defensible distractors). The real exam
almost certainly pairs select-3 items with five or six options. Supporting that means widening the
options shape, the shuffle/permutation helpers, `isOptionKey`, the validator and the runner's option
rendering. Worth doing before relying on select-3 realism.

### 2a. Follow-up — let the tutor serve multiple-response items too

The `record_attempt` tool takes a single `chosenKey`, so it cannot grade a `responseCount > 1`
question. As a safety guard, `fetch_question` now filters to `responseCount: 1`
(`src/lib/tutor/tool-handlers.ts`) — otherwise a student could answer a multi-response checkpoint
**correctly and still be marked wrong**, docking mastery.

Consequence: multiple-response items are currently practised **only in the timed mocks**, not in the
24 hours of tutoring checkpoints. To close it, add `chosenKeys?: string[]` to the `record_attempt`
tool schema (`src/lib/tutor/tools.ts`), pass it to the existing `gradeAnswerSet`, tell the model in
the tool description to collect all N selections before recording, then drop the `responseCount: 1`
filter. Moderate change to a tool schema + prompt; not required for mock realism.

---

## 3. Refresh curriculum text from exam guide v0.1 → v1.0

v1.0 (July 2026) **publishes mechanics v0.1 omitted entirely**. Our 60 Q / 120 min assumption turned
out **correct**, but the surrounding text is now stale:

| File | Stale content | Fix |
|---|---|---|
| `.claude/skills/curriculum.md` (search "does not state question count") | *"guide (v0.1) does not state question count or time limit"* | v1.0 publishes 60 items / 120 min |
| `.claude/skills/curriculum.md` Hour 24 (exam-day strategy) | same claim | same |
| `.claude/skills/question-bank.md:3` | 60/120 flagged as *"our assumption"* | now official |
| curriculum.md (top-of-file + Hour 1 exam map) · question-bank.md:54 | cites *"v0.1"* | → v1.0, July 2026, CCAR-F |
| `.claude/skills/SKILL.md` | *"possibly delisted"* on the Agent Skills course | it is **live**; also add *Introduction to subagents* |

**Missing mechanics to teach (Hour 1 / Hour 24):** $125/attempt · Pearson VUE (online or test
center) · closed book, no browser translation · ~135 min seat time vs 120 min answering · retake
ladder **14 → 30 → 90 days** · **max 4 attempts per rolling 12 months** · credential valid 12 months
· the four-tier certification landscape.

---

## 4. Billing / ops hardening (deferred from Phase 3)

- **Rate limiting** — `@upstash/ratelimit` sliding window (~20 turns/min), checked in the turn-route
  pre-flight *before* any DB hit. Needed before a broad public launch; requires an Upstash account.
- **Mid-loop cost budget** — abort the tutor loop when running cost would exceed the wallet balance,
  reusing the existing iteration-cap exit (`CAP_MESSAGE`). Bounds the single-turn overdraft that
  Phase 1 accepts by design.
- **Webhook amount reconciliation** — re-derive credits from `packId` via `getPack` and assert
  `pack.priceCents === session.amount_total`. Defense-in-depth; metadata is already
  signature-protected, so not exploitable today.
- **`cache_control` on `TUTOR_TOOLS`** — the static tool array is the last uncached stable prefix;
  small margin win. (System prompt + skill bundle + curriculum already cached.)
- **Alert on billing-failure logs** — `notifyBillingFailure` exists; set `ALERT_WEBHOOK_URL` in prod
  so `chargeTurn`/webhook failures actually page someone.

---

## 5. Housekeeping

- **Stale git worktree** at `.claude/worktrees/quizzical-goldstine-59f78f/` holds a full duplicate of
  `.claude/skills/` and `src/lib/` whose `question-seed.ts` has only **93 questions** (vs 153 in the
  main tree). Harmless but it poisons repo-wide greps and could be seeded from by mistake. Remove it.
- **`Developer Productivity with Claude`** and **`Structured Data Extraction`** are named in the
  official six-scenario pool but have **no deep-dive or sample questions in either guide version** —
  a candidate can draw a scenario with zero published prep material. Consider covering them
  defensively.

---

## 6. GLM-5.3 live-API verification (Task 1, credential-blocked)

The model id `"glm-5.3"` (`src/lib/anthropic.ts`) and its pricing — $1.40 / $4.40 per 1M tokens
in/out (`src/lib/billing/pricing.ts`) — are sourced from public pricing announcements, not verified
against Z.ai's live Anthropic-compatible endpoint (`https://api.z.ai/api/anthropic`). No
`GLM_API_KEY` credential has been available in any environment this feature was built in, so the
smoke test described as Task 1 in
`docs/superpowers/plans/2026-08-22-glm-provider-support.md` has never run. When a real key is
supplied, run that smoke test and correct `TUTOR_MODEL_BY_PROVIDER.glm` / `PRICES["glm-5.3"]` if
Z.ai's actual API returns a different model id string, different pricing, or a different `usage`
object shape than assumed.

**Also revisit once the above lands: GLM may not actually be the cheaper backend.** The plan
assumed GLM's headline rate makes it obviously cheap, but that was computed before prompt caching
was gated off for GLM (caching compatibility is itself unconfirmed — see above). The tutor loop
resends the full ~15k-token cacheable bundle (`SKILL.md` + `pedagogy.md` + `question-bank.md` +
system prompt) on every iteration, uncached, for GLM; Claude pays that cost once via `cacheWrite`
then `cacheRead` at a fraction of the rate on every later iteration. Rough modeling of a 5-iteration
turn puts GLM only marginally cheaper than cached Claude, and a longer tool-heavy turn can make GLM
the *more* expensive option. Measure a real GLM turn's `UsageEvent` once a key is available before
describing GLM as the economical choice anywhere user-facing.
