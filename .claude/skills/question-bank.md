# Question Bank — CCA-F-Style Questions

The real CCA-F exam is multiple-choice: one correct answer and three plausible distractors per question, scenario-based, with questions framed by 4 scenarios drawn at random from 6 published ones (customer support agent, Claude Code codegen, multi-agent research, developer productivity, CI/CD, structured data extraction). Results are a scaled score of 100–1,000 with a **720 pass mark**; unanswered questions score as wrong and there is no guessing penalty. The official guide (v0.1) does **not** state question count or time limit — verify both on the exam portal before exam day; mocks below use 60 questions / 120 minutes as a working assumption only. The hardest part of the exam is *distractor literacy* — wrong answers are designed to look reasonable. This file is your library of patterns and exemplars for building those questions live.

## Question Anatomy

Every well-formed CCA-F question has three layers:

1. **A production scenario** — concrete setting, real numbers, a constraint that matters (latency, cost, scale, reliability, security).
2. **A specific architectural decision** to make — never trivia, never recall.
3. **Four options where each one looks defensible** but only one survives close scrutiny. The other three encode common misconceptions.

> Template:
> > *Scenario:* [setting, scale numbers, constraint].
> > [Specific failure or design choice].
> > Which of the following changes most effectively addresses this?
> > A) [common but wrong pattern that the exam expects you to almost pick]
> > B) [correct answer — the PROPORTIONATE fix: prompt-level (criteria, descriptions, examples) when the gap is judgment or information; programmatic (hooks, gates) when compliance must be deterministic]
> > C) [over-engineered alternative that would also work but is wasteful]
> > D) [plausible but tangential fix that doesn't actually address the root cause]

## Mock Protocol (Hours 7, 14, 22, 23)

Mocks fetch from the **hard tier** and must never repeat a question within one mock:

- Call `fetch_question` with `difficulty: "hard"` and `noRepeat: true` for every mock question.
- If it returns `exhausted: true`, the hand-authored hard bank for that concept is used up — **generate a fresh production-grade question** per the Exam-Realism Rubric below, present it, and grade it yourself. Never re-ask a prior question.
- Full mocks (Hours 22, 23) are 60 questions, 120 minutes, drawn to the exam domain weights: Agentic 16, Claude Code 12, Prompts 12, Tool & MCP 11, Context 9.
- This is now enforced structurally: in a mock hour the `fetch_question` handler defaults to `difficulty: "hard"` + `noRepeat: true` even if you omit them, so a forgotten param cannot leak warmup questions or duplicates into a mock. Pass `difficulty: "warmup"` or `noRepeat: false` explicitly only when you are doing post-mock remediation, not the mock itself.

## Exam-Realism Rubric (for generated hard questions)

The real exam is harder than this app's warm-up tier. A generated hard question MUST have:
1. A multi-paragraph production scenario with **≥2 quantified facts** (scale, latency, cost, error rate, deadline) and **≥1 hard constraint** the answer must respect.
2. **Four options, three genuinely defensible** — each the right answer to a slightly different reading — and one best on the stated tradeoff. No obviously-wrong filler.
3. Distractor reasons that name **which constraint each option violates or which root cause it misses** — never "wrong because another option is right", never reference options by letter (they are shuffled).
4. A stem that describes **symptoms and constraints only** — it must not name the fix.
5. Deliberately **slightly above real-exam difficulty**: subtler distractors and one more competing constraint than the candidate expects.

## Multiple-Response Items

The v1.0 exam guide states the item format verbatim: *"Multiple-choice and multiple-response
items; **each item states how many responses to select**."* Author these as follows.

- **State the count in the stem.** End it with "Select 2." — the real exam tells the candidate how
  many to pick, so a stem that hides the count is not exam-realistic.
- **`responseCount` must equal `correctKeys.length`**, every key must be a real option key, and no
  duplicates. `scripts/validate-content.ts` check #10 enforces all three and fails the build.
- **`correctKey` must still be one of `correctKeys`** — pick the single strongest one. The column is
  non-nullable and any legacy single-answer path must degrade to a defensible option, not a wrong one.
- **Use `responseCount: 2`.** With only four options a select-3 item leaves exactly one wrong answer,
  which is close to free marks. Two correct plus two defensible distractors is the only shape that
  discriminates at this option count.
- **Populate `distractorReasons` for all four options** — for each correct key say why it is
  *required*; for each wrong key name the constraint it violates or the root cause it misses. Never
  reference option letters: options are shuffled per fetch.
- **No giveaway sets.** The discrimination must be *which pair works together*, not which single
  option is least absurd. If a candidate can identify both correct answers without reading the
  constraints, the item is measuring reading speed rather than judgment.
- Grading is **exact-set match, no partial credit** (`gradeAnswerSet`), so a near-miss scores the
  same as a blank. Write the two correct options so they are jointly necessary, not merely both true.

## Distractor Design — The Seven Common Wrong Patterns

When generating questions live, build distractors using these patterns. The exam uses them constantly.

1. **Prompt-as-guardrail.** "Add a sentence to the system prompt saying X." Wrong *when the requirement is deterministic compliance* (enforcement, policy caps, security gates) — prompts are guidance that can drift or be routed around. NOT wrong when the gap is judgment or information; there the prompt-level fix IS correct and the structural option is the over-engineering distractor (see Pattern 7 and the proportionality principle below).
2. **Parsing text instead of structured fields.** "Check if the response contains 'done'." Wrong because it's brittle.
3. **Bigger model is always better.** "Switch to Opus." Wrong when the actual fix is structural.
4. **Increase context window / send more history.** Wrong when the actual fix is compaction or RAG.
5. **Retry the whole thing.** Wrong when the actual fix is targeted retry on the specific failure path.
6. **One-shot bigger prompt.** "Add more examples and rules to the system prompt." Wrong when an additional structural component (hook, validator, second pass) is the right answer. But when the gap IS judgment or information, adding criteria/examples IS the correct answer — and the structural option becomes Pattern 7.
7. **Over-engineering.** "Build a routing layer / train a classifier / add ML infrastructure." Wrong when explicit criteria, better tool descriptions, or 2–3 few-shot examples fix the root cause at a fraction of the effort.

A good question will use at least two of these as distractors.

**The proportionality principle (read this before writing any question).** "Prompt-as-guardrail" is wrong **only when the requirement is deterministic compliance** (never refund > $500 → hook). When the failure is a *judgment* gap — unclear escalation boundaries, undifferentiated tool descriptions, inconsistent output format — the prompt-level fix (explicit criteria, enriched descriptions, targeted few-shot) IS the correct answer, and the heavy structural option is the over-engineering distractor. The official sample questions (v0.1) test this in both directions: a hook beats a prompt rule for refund compliance, but explicit criteria + few-shot beats a classifier for escalation calibration, and richer tool descriptions beat a routing layer for tool selection. A good mock mixes both directions so the student can't pattern-match "programmatic = correct".

---

## Exemplars by Concept

### Model Selection

> *Scenario:* A customer-support agent receives 8,000 chats per hour. The first step is routing each chat to one of 12 specialist queues (refund, shipping, technical, etc.). You're currently using Opus for routing and your p95 routing latency is 3.4 seconds. Cost is also blowing past budget. Which change most effectively addresses both issues without sacrificing routing accuracy?
>
> A) Switch the router to Haiku and add a small set of routing examples in the system prompt
> B) Keep Opus but cache the system prompt
> C) Move routing to Sonnet and increase `max_tokens`
> D) Add a fallback to a regex-based classifier when Opus is slow
>
> **Correct: A.** Routing is a classification task where Haiku with good examples is faster and cheaper while maintaining accuracy. B helps cost but not latency much. C is a half-measure. D adds brittleness.

### Tool Calling Termination

> *Scenario:* Your agent has a tool-use loop that sometimes terminates after one tool call and sometimes runs through 40+ before stopping. Your loop's exit condition is `if "done" in response.content.lower(): break`. The on-call engineer wants this fixed today. What change most effectively addresses the root cause?
>
> A) Add a system prompt instruction telling the model to say "I am done" only when truly finished
> B) Switch the termination check to `response.stop_reason == "end_turn"` and add an iteration cap as a backstop
> C) Add more tool descriptions so the model can decide when it's done
> D) Increase `max_tokens` so the model has more room to finish
>
> **Correct: B.** Parsing text is the bug. Check the structured field. The iteration cap is a defense-in-depth backstop. A doubles down on the same broken approach. C and D are tangential.

### MCP vs Skill boundary

> *Scenario:* Your team has built an MCP server exposing `search_kb`, `get_document`, and `summarize_section` tools. You also have a Claude Code skill at `~/.claude/skills/legal-research/SKILL.md` describing a workflow for legal research. A user asks "find precedent for non-compete enforcement in California." What is the correct understanding of how these two layers interact?
>
> A) The MCP server triggers first because tools are higher priority than skills
> B) The skill description matches the request first; once active, the skill's workflow invokes the MCP tools as it needs them
> C) Both fire in parallel and the host merges the results
> D) The skill is purely documentation; tools always fire regardless of skill presence
>
> **Correct: B.** Skills are model-side workflow descriptions selected by description match. Tools (including MCP tools) are invoked from within the workflow when needed. A reverses the layer order. C and D misunderstand both layers.

### Guardrails (programmatic vs prompt)

> *Scenario:* Your agent must never process refunds over $500 without human approval. The CTO has reviewed three proposals. Which one ships?
>
> A) Add to `CLAUDE.md`: "Never process refunds over $500 without human approval."
> B) Add the rule to the system prompt with three examples
> C) Add a `PreToolUse` hook on `process_refund` that denies when `amount > 500` and emits a human-review request
> D) Train a classifier to detect refund requests above $500 in user messages and prepend a warning to the system prompt
>
> **Correct: C.** Programmatic interception is enforcement. A and B are prompt-as-guardrail variants that can drift or be routed around. D is over-engineered and still fails enforcement — a classifier that prepends a warning is neither a hook nor a gate, just a guardrail with extra steps.

### Agent Pattern Choice

> *Scenario:* You're building a code-review agent. It must analyze a 200-file PR, flag issues in each file locally, then identify cross-file consistency problems. You're seeing degraded quality when the agent tries to do both in one pass — it misses subtle cross-file issues. Which architectural change most effectively addresses this?
>
> A) Increase the model's context window allocation and pass all 200 files in one prompt
> B) Switch to Opus to handle the larger reasoning load
> C) Decompose into two passes: per-file subagents for local issues + a separate integration pass for cross-file analysis
> D) Add a longer system prompt with explicit instructions to check both local and cross-file issues
>
> **Correct: C.** Attention dilution across 200 files is the problem; orchestrator-worker decomposition fixes it structurally. A and B throw resources at a structural problem. D is prompt-as-fix for what is fundamentally an architecture/attention problem — contrast with calibration scenarios where explicit criteria in the prompt IS the proportionate answer.

### Multi-Agent Orchestration (Hub & Spoke)

> *Scenario:* A coordinator must fan out 6 independent summarization jobs as isolated subagents that run concurrently. Its `allowedTools` is `['Read', 'Grep']` and you emit the jobs as six sequential turns; subagents never spawn and everything runs in one context. Which fix is correct?
>
> A) Add `'Task'` to `allowedTools` and emit six `Task` calls in a single response so they run in parallel
> B) Increase `max_tokens` so the coordinator has room to spawn subagents
> C) Lower temperature so the coordinator deterministically delegates
> D) Pass all six docs in one prompt and summarize each in turn
>
> **Correct: A.** Subagent spawning needs the `Task` tool; multiple `Task` calls in one response is what runs them in parallel. B/C are unrelated knobs. D collapses back to the single-context dilution you're avoiding. Companion distractor: forwarding the coordinator's *entire* history to a subagent (context pollution) — pass only explicit, scoped context.

### Session Management & Workflows

> *Scenario:* A migration agent crashed after 40 tool calls. You want to continue tomorrow with the exact accumulated context, and track each migration under a stable identifier. What's correct?
>
> A) Start fresh and paste a summary into the system prompt
> B) Use `--resume` to continue the existing *named* session with its preserved context
> C) Use `fork_session` to branch a new exploration from scratch
> D) Raise the iteration cap and re-run from the beginning
>
> **Correct: B.** `--resume` continues a prior session with context intact; a named session makes it findable. A loses the exact accumulated context this scenario requires preserving (prefer fresh + an injected summary only when prior tool results are stale — not the case here), C is for branching exploration (not resuming the same line), D throws away progress. Related traps: ignoring **stale context** in long sessions (re-ground current state), and forcing a static prompt chain onto a task that needs dynamic adaptive decomposition.

### Hooks & Escalation Signals

> *Scenario:* A support agent should escalate hard tickets. A proposal escalates when the model's self-reported confidence < 0.6, but it reports 0.9 on tickets it answers wrong and 0.4 on ones it handles fine. Sound trigger?
>
> A) Recalibrate the self-reported threshold to 0.75
> B) Escalate on deterministic, observable signals (hard-limit hook, repeated failed attempts, policy-matched category)
> C) Average two self-reported confidence scores
> D) Add "be honest about your confidence" to the system prompt
>
> **Correct: B.** Self-reported confidence is unreliable and doesn't track correctness — no threshold fixes that. Sentiment is also a poor proxy (anger ≠ complexity). Escalate on complexity/risk signals. Related: use a `PostToolUse` hook for deterministic data normalization (e.g., phone numbers → E.164) — not a system-prompt instruction, and not `PreToolUse` (output doesn't exist yet).

### Claude Code: Path-Scoped Rules

> *Scenario:* Your codebase has distinct conventions per area: React components use hooks, API handlers use async/await with specific error handling, and DB models follow a repository pattern. Test files live beside the code they test (e.g. `Button.test.tsx` next to `Button.tsx`) all over the tree, and every test must follow the same conventions regardless of location. What's the most maintainable way to make Claude apply the right conventions automatically?
>
> A) Create rule files in `.claude/rules/` with YAML frontmatter `paths` glob patterns so conventions load conditionally by file path
> B) Consolidate every convention into the root CLAUDE.md under per-area headers and rely on Claude to infer which section applies
> C) Create one skill per code area in `.claude/skills/`, each carrying that area's conventions in its SKILL.md body
> D) Place a separate CLAUDE.md in each subdirectory containing that directory's specific conventions
>
> **Correct: A.** Path-scoped rules (`paths: ["**/*.test.tsx"]`) apply conventions by file pattern regardless of directory — exactly what spread-out test files need. B relies on inference from headers, which is unreliable; nothing guarantees the right section is applied to the right file. C uses skills, which are invoked on demand for workflows — they aren't deterministically loaded by file path, so automatic application isn't guaranteed. D uses directory-bound CLAUDE.md files that can't follow a convention cutting across many directories; you'd duplicate the test rules everywhere.

### Claude Code: Plan Mode vs Direct Execution

> *Scenario:* You've been assigned to restructure a monolithic application into microservices — changes across dozens of files plus decisions about service boundaries and module dependencies. Which approach should you take in Claude Code?
>
> A) Enter plan mode to explore the codebase, understand dependencies, and design the approach before making any changes
> B) Start in direct execution and make changes incrementally, letting the implementation reveal the natural service boundaries
> C) Use direct execution with comprehensive upfront instructions describing exactly how every service should be structured
> D) Begin in direct execution and switch to plan mode only if you hit unexpected complexity during implementation
>
> **Correct: A.** Plan mode is built for large-scale, multi-file, architectural work — safe exploration and design before committing to changes. B discovers dependencies mid-rewrite, which is how you buy expensive rework; the boundaries should be designed, not stumbled into. C assumes you already know the right structure — without exploring the code, you don't. D defers plan mode even though the complexity is already stated in the task (architecture, dozens of files); it ignores what you know now.

### Claude Code: CI/CD Headless Mode

> *Scenario:* Your CI script runs `claude "Review this pull request for security issues"` but the job hangs indefinitely — logs show Claude Code waiting for interactive input. What's the correct fix for automated pipelines?
>
> A) Add the `-p` (print) flag: `claude -p "Review this pull request for security issues"`
> B) Set `CLAUDE_HEADLESS=true` in the pipeline environment before invoking the command
> C) Redirect stdin from /dev/null so the process can't block on input: `claude "..." < /dev/null`
> D) Add the `--batch` flag so Claude Code queues the prompt and exits when processing completes
>
> **Correct: A.** `-p` / `--print` is the documented non-interactive mode: process the prompt, write to stdout, exit — what CI requires. B is incorrect; there is no `CLAUDE_HEADLESS` environment variable, this feature doesn't exist. C is a Unix workaround that doesn't engage Claude Code's actual non-interactive mode; behavior remains undefined. D is also incorrect; there is no `--batch` flag in the Claude Code CLI.

### Batch Processing Fit

> *Scenario:* Real-time Claude calls currently power two workflows: (1) a blocking pre-merge check developers wait on, and (2) a technical-debt report generated overnight. Your manager proposes moving both to the Message Batches API for its 50% cost savings. How should you evaluate this?
>
> A) Move only the overnight report to batch processing; keep the pre-merge check on the synchronous API
> B) Move both to batch with status polling, since batches usually finish much faster than the 24-hour ceiling
> C) Keep both on real-time calls because batch results come back unordered and can't be matched to requests
> D) Move both to batch with a timeout that falls back to a real-time call whenever a batch runs long
>
> **Correct: A.** Batch trades latency (up to 24h, no SLA) for 50% savings — ideal for overnight reports, unacceptable for a check developers block on. B is wrong because "usually faster" is not a guarantee; a blocking workflow can't rest on a no-SLA processing window. C is a misconception — batch responses correlate to requests via `custom_id`; ordering is a non-issue. D adds needless complexity that still makes developers wait out the timeout; the clean fix is matching each workflow to the right API.

### Structured Error Taxonomy

> *Scenario:* Every tool on your MCP server returns the string "Operation failed." on any failure — timeouts, invalid input, and policy violations alike. The agent retries policy-violation failures in a loop and gives up immediately on transient timeouts. What change most effectively fixes this behavior?
>
> A) Return structured error metadata: an `errorCategory` (transient/validation/business/permission), an `isRetryable` boolean, and a human-readable description
> B) Add a system prompt instruction telling the agent to think carefully about whether each failure is worth retrying
> C) Set a global cap of three retries per tool so the policy-violation loop can never run more than three times
> D) Switch the agent to a more capable model that can infer the likely failure cause from surrounding context
>
> **Correct: A.** The agent can only make good recovery decisions from structured error context — category and retryability tell it to retry timeouts and stop on policy violations. B fails because the agent has no signal to reason over; every failure looks identical, and instruction quality can't fix missing information. C bounds the damage but fixes neither the wasted retries on business errors nor the premature give-up on transient ones. D is incorrect; no model can reliably infer error class from a string that carries no class information.

### Provenance & Conflicting Sources

> *Scenario:* Your research system's document-analysis subagent finds two credible industry reports stating different market sizes — one collected data in 2023, the other in 2025. The synthesis agent currently picks the larger figure and drops the other. What should happen instead?
>
> A) Include both figures, each annotated with source attribution and data-collection date, and let the report distinguish them rather than silently choosing
> B) Use the more recent figure and discard the older one, since fresher data supersedes stale data
> C) Average the two figures so the report presents a single number that reflects both sources
> D) Send the search subagent back out repeatedly until it finds a third source that breaks the tie
>
> **Correct: A.** Conflicting credible values get annotated with attribution and dates — temporal differences are context, not contradictions, and the reader needs both. B is wrong because recency alone doesn't invalidate the earlier figure (different methodology/scope may explain it); silently discarding loses provenance. C fabricates a statistic neither source reported and destroys attribution. D delays the report with a third source that may still conflict and doesn't resolve a difference that may be methodological or temporal.

### Proportionality: Descriptions First

> *Scenario:* Production logs show your agent frequently calls `get_customer` when users ask about orders ("check my order #12345") instead of `lookup_order`. Both tools have one-line descriptions ("Retrieves customer information" / "Retrieves order details") and accept similar identifier formats. What's the most effective FIRST step?
>
> A) Add 5–8 few-shot examples to the system prompt demonstrating order queries routing to `lookup_order`
> B) Expand each tool's description to cover input formats, example queries, edge cases, and when to use it versus the similar tool
> C) Build a routing layer that parses user input each turn and pre-selects the appropriate tool from detected keywords
> D) Consolidate both into a single `lookup_entity` tool that accepts any identifier and picks the backend internally
>
> **Correct: B.** Descriptions are the primary tool-selection mechanism; enriching them is the low-effort, high-leverage fix that addresses the root cause. A adds token overhead while leaving the root cause — undifferentiated descriptions — in place. C is over-engineered — it bypasses the model's language understanding and adds a brittle keyword layer before simpler fixes were tried. D is a real architectural option, but far more effort than a first step warrants when the immediate defect is description quality. C and D are the over-engineering distractors here.

### Agent SDK Hooks & Data Normalization

> *Scenario:* A logistics agent orchestrates three MCP tools you can't modify: one returns Unix epoch milliseconds and a numeric status code, one returns ISO 8601 timestamps and a string status, and one returns Unix epoch in seconds with its own, misaligned status codes. Processing 40,000 orders/day, the agent starts asserting impossible sequences ("shipped before ordered") because it's comparing timestamps across mismatched units. What fixes this before the release freeze?
>
> A) Document each tool's format in the system prompt and ask the model to convert before comparing
> B) Add a `PostToolUse` hook that normalizes every tool's timestamp and status code to one canonical format before the result reaches the model
> C) Increase context so the model can see more of each raw payload while reasoning through the conversion
> D) Stand up a separate normalization microservice all three tools route through
>
> **Correct: B.** `PostToolUse` hooks transform tool results *before the model processes them* — the model never needs to learn three formats. A leaves error-prone conversion to per-turn model judgment (probabilistic, not deterministic). C gives the model more inconsistent data to reason over, not less. D is over-engineered relative to a hook that ships in the same release. Companion distractor direction: a hook is not only a gate — it blocks-and-redirects (refund > $500 → human escalation with a structured handoff, not a dead-end deny) — and not every judgment gap should become a hook: when the requirement isn't deterministic compliance (e.g. routing ambiguity from near-identical tool descriptions), the proportionate fix is better descriptions and few-shot examples, not a `PreToolUse` keyword gate.

### Proportionality: Criteria First

> *Scenario:* Your support agent hits 55% first-contact resolution against an 80% target. Logs show it escalates straightforward cases (standard damage replacements with photo evidence) while attempting complex policy-exception cases itself. What most effectively improves its escalation calibration?
>
> A) Add explicit escalation criteria to the system prompt with few-shot examples showing when to escalate versus resolve autonomously
> B) Have the agent self-report a confidence score before each response and auto-route to humans below a threshold
> C) Train a separate classifier on historical tickets to predict which requests need escalation before the agent runs
> D) Add sentiment analysis and escalate automatically whenever customer frustration crosses a threshold
>
> **Correct: A.** The root cause is unclear decision boundaries — explicit criteria plus few-shot examples is the proportionate fix. This is criteria definition, not prompt-as-enforcement: nothing here needs a deterministic guarantee, it needs better judgment. B is wrong because self-reported confidence is poorly calibrated — this agent is already confidently wrong on the hard cases. C is over-engineered: labeled data and ML infrastructure before prompt-level criteria have even been tried. D relies on sentiment, which doesn't track case complexity — calm customers bring hard problems and angry ones bring trivial ones.

---

## Mini-Mock — Week 1 (Hour 7)

10 questions, ~15 minutes, covering: model selection & distractor literacy, context window management, batch processing & extraction quality, structured outputs, tool calling mechanics & patterns.

When generating live, target this mix:
- 1 on model selection / distractor literacy
- 2 on context window management
- 2 on batch processing & extraction quality (use the Batch Processing Fit exemplar for batch; for extraction quality, generate from Live Guidance — target nullable schema design or enum-other for partial data)
- 2 on structured outputs (incl. nullable / enum-other schema design)
- 3 on tool calling mechanics & patterns

After scoring: every wrong answer triggers a remediation note in `[Weak Areas]`.

---

## Mini-Mock — Week 2 (Hour 14)

10 questions, ~15 minutes, covering: MCP integration & configuration, MCP primitives, tool interface design & structured errors, skill-vs-tool boundary, orchestrator-workers, evaluator-optimizer, agentic loop termination, error propagation & provenance.

Target mix:
- 2 on MCP integration / configuration / primitives
- 2 on tool interface design & structured errors
- 1 on skill-vs-tool boundary
- 2 on agent patterns (Orchestrator-Workers, Evaluator-Optimizer)
- 2 on agentic loop / stop_reason
- 1 on error propagation & provenance (the Structured Error Taxonomy exemplar covers single-tool error categories; for multi-agent propagation, generate from Live Guidance)

---

## Full Mock 1 (Hour 22)

60 questions, 120 minutes, timed (our mock format — the real exam's count and duration are unverified; see the note at the top of this file). Match the official domain weights:

| Domain | Questions |
|---|---|
| Agentic Architecture & Orchestration | 16 |
| Claude Code Configuration & Workflows | 12 |
| Prompt Engineering & Structured Output | 12 |
| Tool Design & MCP Integration | 11 |
| Context Management & Reliability | 9 |

Score by domain. Lowest-scoring domain gets the remaining session time for remediation.

Note: Week 3 (Hours 15–19) now carries the Claude Code Configuration domain (CLAUDE.md hierarchy, rules, skills frontmatter, plan mode, CI/CD flags). When generating Claude Code questions, draw on those hours plus the seeded exemplars above — and include at least two proportionality-direction questions (where the prompt-level fix is correct) so the mock can't be gamed by always picking the structural option.

---

## Full Mock 2 (Hour 23)

Same shape as Mock 1, different questions. Trajectory matters: improvement on Mock 1's weakest domain is the success signal.

Mocks now draw from the hard tier (above real-exam difficulty), so the bar is higher and predictive:
- **Ready to sit the real exam:** hard-mock ≥ **90% overall (≈900/1000, Anthropic's own practice target)** AND no domain below **75%**.
- **Not ready — keep training:** overall < 85% OR any domain < 70%. A >900 here means genuinely ready, not falsely confident.

---

## Warm-Up Mental Models (Practice-Exam Remediation)

Targeted at the loophole patterns from the student's practice exam (weak: Claude Code for CI 67%; missed partial-results and tool-overlap items in Multi-Agent Research; CSR scored 100% but felt shaky). Run these as warm-up retrieval before the relevant hours, and pull the matching seeded questions (`partial-results-coverage-annotation`, `tool-overlap-rename-descriptions`, `criteria-over-fewshot-decision-boundary`, `fewshot-for-output-format`, `ci-no-filter-inline-reasoning`, `ci-disable-noisy-category`, `batch-no-midrequest-tool-calling`, `csr-prerequisite-gate-hook`).

### The Fix-Selection Decision Tree — the #1 loophole: the "few-shot reflex"

The student defaults to *few-shot examples / add-to-prompt / confidence-display* when the correct lever is something more precise. Map the **symptom** to the **lever**:

| Symptom | Correct lever | NOT this |
|---|---|---|
| Model picks the wrong tool among similar ones | Rename + rewrite tool **descriptions** (distinct inputs/outputs/boundaries) | few-shot, lower temperature, consolidate tools |
| Inconsistent **decision** — "what counts as a bug / which severity" | Explicit **categorical criteria** + one concrete example per level | few-shot, static CLAUDE.md lookup table, "be conservative", confidence cutoff |
| Inconsistent **format / output shape** | **3–4 few-shot examples** of the exact shape | longer prose spec, lower temperature, criteria |
| A rule that must **never** break (verify before refund, refund ≤ $500) | Programmatic **hook / prerequisite gate** | system-prompt rule, few-shot, tool ordering |
| **Judgment** calibration — when to escalate vs resolve | Explicit escalation **criteria + few-shot** in the prompt | self-reported confidence, sentiment, trained classifier |
| Too many findings but you may **not** filter them | **Inline reasoning + confidence** per finding (speed triage, hide nothing) | filter high-confidence, cap to N, raise threshold |
| One **noisy category** erodes trust in all findings | **Temporarily disable** that category, keep precise ones, fix its prompt, re-enable | confidence display, bigger model, "be more careful" |
| Upstream returned **partial results** | Annotate **coverage** (well-supported vs gaps) and pass forward | return error, retry-all, mark complete, impute missing |

The one discrimination to drill until automatic: **few-shot fixes FORMAT and demonstrates ambiguous cases; explicit criteria fix DECISION boundaries; renamed descriptions fix TOOL SELECTION; hooks enforce COMPLIANCE.** The two seeded twins `criteria-over-fewshot-decision-boundary` and `fewshot-for-output-format` are deliberately near-identical scenarios with opposite answers — use them back-to-back to force the distinction.

### Constraint-Reading Checklist — the silent-killer loophole

Before choosing, list every **hard constraint** in the stem ("no findings filtered before review", "never refund before verifying", "must stay under 24h"). Then eliminate any option that violates one — no matter how good it otherwise sounds. The exam plants attractive options that quietly break a stated rule (e.g., a "filter to high-confidence" option under a "nothing may be filtered" constraint).

### Batch API — what it actually can't do

- **CAN:** ~50% cost savings, up-to-24h window, correlate via `custom_id`, accept JSON output schemas.
- **CANNOT:** execute a tool mid-request and feed the result back for the model to continue — no multi-turn tool-calling within one request. **Iterative tool-calling workflows are the disqualifier** — not correlation, not cost, not schema support.

### Customer Support Resolution Agent — the proportionality map (the "100% but shaky" zone)

CSR feels slippery because it mixes four domains and the right lever flips per failure type. Anchor on this:

| The requirement is… | Use | Example |
|---|---|---|
| A rule that must hold every time (compliance) | Programmatic **hook / prerequisite gate** | block `process_refund` until `get_customer` verified; deny refund > $500 |
| A judgment call the model keeps getting wrong | Explicit **criteria + few-shot** | when to escalate vs resolve; honor explicit human requests |
| The model picking the wrong tool | Tool **descriptions** | `get_customer` vs `lookup_order` disambiguation |
| Heterogeneous tool output the model chokes on | **PostToolUse hook** (normalize) | phone formats → E.164 |
| A multi-concern request | **Decompose** into items, handle each, synthesize one resolution | refund + address change + complaint in one message |

Rule of thumb: **deterministic guarantee → code (hook/gate); better judgment → criteria; right tool → description.** When two options are a hook and a prompt, ask: *"Does this rule need to hold 100% of the time?"* If yes, it's the hook — every time.

---

## Live Generation Guidance

When you need a checkpoint question mid-session and don't want to use an exemplar above:

1. Pick the *concept* being tested.
2. Pick the *production setting* (use realistic numbers — 100K req/day, 30K-token prompt, $5K/month budget).
3. State the *specific architectural decision* to make.
4. Write four options:
   - One correct (the PROPORTIONATE fix — sometimes prompt-level, sometimes programmatic).
   - One prompt-as-enforcement distractor OR one over-engineering distractor (whichever direction the correct answer is NOT).
   - One bigger-model-is-better OR throw-more-tokens distractor.
   - One plausible but tangential fix.
5. After the student answers, ask "walk me through your reasoning" before revealing.
6. Reveal and dissect *every distractor* — why each one is wrong is where the learning happens.
