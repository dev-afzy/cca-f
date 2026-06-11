# Curriculum — 23 Hours, 4 Weeks

Structure follows the official CCA-F exam guide: Week 1 patches API foundations and extraction quality, Week 2 goes deep on MCP, tool design, and agent patterns, Week 3 covers Claude Code configuration and production workflows (Domain 3, 20% of the exam), and Week 4 closes the Agentic Architecture deep-dive (multi-agent orchestration, session management) before running the mocks. Domain weights: Agentic 27%, Claude Code 20%, Prompts 20%, Tool & MCP 18%, Context 15%.

Each hour gives:
- **Objectives** (what the student should be able to do at the end)
- **Topics** (what to cover)
- **Friction zones** (where students typically stumble — watch for these)
- **Suggested analogy seeds** (starting points for the Child's Analogy step)

The instructor (you) generates the actual teaching content live, using the Child-to-Architect 4-step loop from `pedagogy.md` for every concept.

---

## Week 1 — Foundation Patching & Core API Architecture (Hours 1–7)

### Hour 1 — Diagnostic + Exam Map & Distractor Literacy

**Objectives:** Surface broken knowledge across the four prereq courses. Internalize the exam's structure and scoring. Learn the distractor patterns the exam reuses — including why "switch to a bigger model" is almost always a wrong answer.

**Topics:**
- Run the 3-question diagnostic battery from `pedagogy.md`.
- Exam map: 5 domains weighted 27% (Agentic) / 20% (Claude Code) / 20% (Prompts) / 18% (Tool & MCP) / 15% (Context). Questions are framed by 4 scenarios drawn at random from 6 published ones (customer support agent, Claude Code codegen, multi-agent research, developer productivity, CI/CD, structured data extraction).
- Scoring mechanics: scaled 100–1,000, pass mark 720, pass/fail only, no penalty for guessing — never leave a blank.
- Distractor literacy: the recurring wrong-answer shapes — model-swap ("switch to Opus"), prompt-as-enforcement, over-engineering (classifiers/routing layers when a criteria fix suffices), more-tokens/more-context.
- Model family (Haiku/Sonnet/Opus) as background vocabulary only: the exam uses model selection in *distractors*, not as a tested topic. Know the latency/cost/capability tradeoffs so you can recognize when a model swap dodges the structural fix.

**Friction zones:** Treating model choice as a tested topic and memorizing benchmark numbers. Picking "switch to Opus" under pressure. Studying by domain weight alone instead of practicing scenario judgment.

**Analogy seed:** The exam guide is a trail map. The weights show where the elevation is; the distractors are false trails that look freshly groomed precisely so you'll take them.

---

### Hour 2 — Context Window Management

**Objectives:** Distinguish context window from output tokens. Apply truncation/summarization/RAG strategies appropriately.

**Topics:**
- Context window vs `max_tokens` — they are different numbers, often confused.
- The `system` block, conversation history, message structure.
- Strategies: sliding window, summarization compaction, RAG, fact extraction.
- The "lost in the middle" effect: models attend reliably to the start and end of long inputs — put key-findings summaries first and use explicit section headers.
- A persistent "case facts" block: extract transactional facts (amounts, dates, order numbers, statuses) into a structured block included in every prompt, outside summarized history, so progressive summarization can't blur them.
- Trimming verbose tool results to only relevant fields *before* they accumulate (a 40-field order lookup when 5 fields matter).
- When the long-context approach beats RAG and when it doesn't.

**Friction zones:** Treating context window as if it's free. Sending the entire history every turn. Not knowing where to put the most cache-friendly content (long-stable docs near the top). Progressive summarization that turns "$847.50 refund by Friday" into "a refund was discussed". Letting raw tool outputs pile up turn after turn.

**Analogy seed:** Context window is like a chef's prep counter. You can only fit so much. You can put everything on it (long-context), or you can have a runner bring ingredients in just-in-time (RAG), or you can keep a tidy summary of what's already been used (compaction).

---

### Hour 3 — Batch Processing & Extraction Quality

**Objectives:** Match synchronous vs Message Batches API to workflow latency tolerance. Design validation-retry loops that know their own limits. Route low-confidence extractions to human review with calibrated thresholds.

**Topics:**
- Message Batches API: 50% cost savings, up to 24-hour processing window, **no guaranteed latency SLA**, `custom_id` for request/response correlation, no multi-turn tool calling within a batch request.
- Matching API to workflow: blocking work (pre-merge checks) stays synchronous; latency-tolerant work (overnight reports, weekly audits, nightly test generation) goes to batch.
- Failure handling: resubmit only the failed `custom_id`s, with modifications (e.g., chunking documents that blew the context limit). Refine prompts on a sample set before batching large volumes.
- Retry-with-error-feedback: resend the document + failed extraction + specific validation error. Know when retries CANNOT work — the information simply isn't in the source document.
- Field-level confidence scores, calibrated against labeled validation sets — never raw self-reported confidence.
- Stratified random sampling of high-confidence extractions to measure error rates and catch novel failure patterns.
- Segment accuracy by document type and field: a 97% aggregate can hide a failing segment.

**Friction zones:** Putting a blocking workflow on the batch API because "it's usually fast". Retrying an extraction whose data isn't in the document. Trusting aggregate accuracy. Using uncalibrated self-reported confidence for review routing.

**Analogy seeds:**
- Batch vs sync is overnight freight vs a courier — half the price if nobody is standing at the door waiting.
- Confidence calibration is a bathroom scale you verify against known weights before you trust its readings.

---

### Hour 4 — Structured Outputs (JSON Mode)

**Objectives:** Get reliable JSON from Claude. Choose between tool-calling-as-schema and prompt-engineered JSON.

**Topics:**
- Stop sequences and prefill.
- Tool definitions as a way to force schema adherence.
- Validation, retry-on-malformed patterns.
- When *not* to use structured outputs (natural-language is often better for human-facing).
- Schema design details the exam tests: optional/nullable fields so the model returns `null` instead of fabricating values for required fields; enum + `"other"` + detail-string for extensible categories; an `"unclear"` enum value for ambiguous cases.
- Strict schemas via tool use eliminate *syntax* errors but not *semantic* errors (line items that don't sum to the stated total) — validate semantics separately, e.g. extract `calculated_total` alongside `stated_total` and flag discrepancies.

**Friction zones:** Trying to coerce JSON via prompt alone when tools-as-schema is more reliable. No validation step. No retry strategy for malformed output. Over-using JSON when the downstream consumer is a human. Marking every field required and forcing fabrication. Assuming schema compliance means the values are correct.

**Analogy seed:** Asking for JSON via prompt is like asking a friend to write you a check using only a description. Defining a tool schema is handing them a real check template with boxes to fill in.

---

### Hour 5 — Tool Calling Mechanics

**Objectives:** Trace one full tool-use loop end-to-end. Understand `tool_use` / `tool_result` block alternation.

**Topics:**
- Anatomy of a tool definition (`name`, `description`, `input_schema`).
- The two-message round-trip pattern: assistant emits `tool_use`, your code runs the tool, you reply with `tool_result`, assistant continues.
- `stop_reason: tool_use` vs `stop_reason: end_turn` — the agentic loop terminates on the structured field, not on text content.
- Error reporting via `is_error: true` inside `tool_result`.

**Friction zones:** Parsing text to decide when to call a tool. Forgetting to send tool results back. Sending malformed tool_result blocks. Not handling tool errors.

**Analogy seed:** Tool calling is passing notes in class. Model writes "please look up X" → your code reads, gets the answer → you pass back "X is 42". Conversation resumes.

---

### Hour 6 — Tool Calling Patterns

**Objectives:** Compose multi-tool flows. Choose tool-choice control correctly. Know when tools are an anti-pattern.

**Topics:**
- `tool_choice`: `auto` / `any` / `tool` / `none`. When each makes sense.
- Parallel tool calls in one response.
- Forced tool use for guaranteed extraction.
- Tool result formatting (strings vs structured).
- When tools are over-engineering (a single prompt would have done it).
- Tool-count degradation: 18 tools instead of 4–5 measurably degrades selection reliability. Scope each agent's tool set to its role.
- Scoped cross-role tools for high-frequency needs (a `verify_fact` tool for a synthesis agent) while routing complex cases through the coordinator.

**Friction zones:** Always defaulting to `tool_choice: auto`. Not knowing `none` exists. Setting up tools for trivial prompts. Letting the model decide *whether* to use tools when you've already decided it must. Granting every agent every tool "to be flexible".

**Analogy seed:** `tool_choice` is the difference between letting the model pick its own kitchen knife (`auto`), forcing it to use *some* knife (`any`), forcing the chef's knife specifically (`tool`), or saying "no knives this time, just talk" (`none`).

---

### Hour 7 — Week 1 Consolidation + Mini-Mock

**Objectives:** Synthesize Week 1 into one architectural scenario. Take a 10-question mini-mock. Patch any concept under 70% mastery.

**Topics:**
- Scenario walkthrough: design the API layer for a customer support bot. Cover model selection, tools, structured outputs, batch vs sync processing, and extraction quality.
- Mini-mock from `question-bank.md` → **Week 1 Mini-Mock**.
- Targeted remediation on any concept still scoring below 70%.

**Friction zones:** Whatever surfaced this week.

---

## Week 2 — Advanced MCP & Agentic Workflows (Hours 8–14)

### Hour 8 — MCP Integration & Configuration

**Objectives:** Configure MCP servers at the right scope. Use MCP resources to cut exploratory tool calls. Select built-in tools (Read/Write/Edit/Bash/Grep/Glob) correctly.

**Topics:**
- The host / client / server model in one diagram — background only. (Transports, JSON-RPC framing, and lifecycle internals are Level-300 material and explicitly NOT on this exam.)
- Project-scoped `.mcp.json` (version-controlled, shared with the team) vs user-scoped `~/.claude.json` (personal/experimental servers). Both available simultaneously; all configured servers' tools are discovered at connection time.
- Environment-variable expansion in `.mcp.json` (e.g. `${GITHUB_TOKEN}`) — credentials never committed.
- MCP resources as content catalogs (issue summaries, documentation hierarchies, DB schemas) so agents see what data exists without exploratory tool calls.
- Community MCP servers over custom builds for standard integrations (Jira); custom servers reserved for team-specific workflows.
- Built-in tools: Grep for content search, Glob for path patterns (`**/*.test.tsx`), Read/Write for full files, Edit for unique-anchor modifications — with Read + Write as the fallback when Edit's anchor isn't unique. Explore incrementally: Grep for entry points, then Read to follow imports — not "read everything upfront".

**Friction zones:** Committing secrets instead of `${VAR}` expansion. Putting a team server in user scope (teammates silently lack it). Building a custom server where a community one exists. Reading the whole repo before searching it.

**Analogy seed:** `.mcp.json` vs `~/.claude.json` is the office toolbox vs the multitool on your own keychain — the office one is stocked for everyone, yours travels with you.

---

### Hour 9 — MCP Servers: Tools, Resources, Prompts

**Objectives:** Distinguish the three MCP primitives. Choose the right one for a given need.

**Topics:**
- **Tools** — executable functions the model can call.
- **Resources** — readable data (files, DB rows) the model can request.
- **Prompts** — pre-defined prompt templates the host can offer to users.
- Why all three exist instead of just tools.

**Friction zones:** Implementing everything as a tool when resources would be cleaner. Confusing resources with "context Claude reads automatically" — they're requested, not pushed.

**Analogy seed:** Tools are buttons, resources are file cabinets, prompts are pre-written form letters. Different shapes for different uses.

---

### Hour 10 — Tool Interface Design & Structured Errors

**Objectives:** Write tool descriptions that drive correct selection among similar tools. Design error responses an agent can actually act on.

**Topics:**
- Descriptions are the PRIMARY mechanism for tool selection. Include input formats, example queries, edge cases, and explicit boundaries vs similar tools.
- Fixing misrouting: rename overlapping tools (`analyze_content` → `extract_web_results`), split generic tools into purpose-specific ones (`analyze_document` → `extract_data_points` / `summarize_content` / `verify_claim_against_source`).
- System-prompt keyword sensitivity can override good descriptions — review prompts for accidental tool associations.
- The error taxonomy the exam tests: **transient** (timeout, service down) vs **validation** (bad input) vs **business** (policy violation) vs **permission**. The MCP `isError` flag.
- Structured error metadata: `errorCategory`, `isRetryable` boolean, human-readable description. `retriable: false` + customer-friendly text for business-rule violations.
- Access failures (need a retry decision) are NOT valid empty results (successful query, no matches) — report them differently.
- Subagents recover locally from transient failures; they propagate only what they can't resolve, with partial results and what was attempted.
- (Auth patterns trimmed to one line: credentials live in env vars, never in tool descriptions. OAuth/key-rotation depth is out of exam scope.)

**Friction zones:** Descriptions like "does the thing". A uniform "Operation failed" for every error class. Retry storms on business errors. Treating "no matches" as an outage.

**Analogy seed:** A good error is an airline announcement: "delayed 30 minutes, mechanical, rebooking at gate 12" lets you act. "Flight disrupted" does not.

---

### Hour 11 — Error Propagation & Provenance in Multi-Agent Systems

**Objectives:** Design failure flows a coordinator can recover from. Preserve claim-source mappings through synthesis. Handle conflicting and temporal data correctly.

**Topics:**
- Structured error context to the coordinator: failure type, attempted query, partial results, potential alternative approaches.
- The three anti-patterns: silent suppression (returning empty-as-success), generic statuses ("search unavailable"), and terminating the whole workflow on one failure.
- Coverage annotations in synthesis output: which findings are well-supported vs which topic areas have gaps from unavailable sources.
- Claim-source mappings (source URL, document name, excerpt) that downstream agents must PRESERVE through summarization — attribution dies in compression unless it's structured.
- Conflicting statistics from credible sources: annotate both with attribution; never arbitrarily pick one or average them. The coordinator decides reconciliation.
- Temporal data: require publication/collection dates in structured outputs so a 2023-vs-2025 difference isn't misread as a contradiction.
- Render content appropriately in synthesis: financial data as tables, news as prose, technical findings as structured lists.

**Friction zones:** "Search unavailable" hiding everything the coordinator needed. Summarizers stripping attribution. Cherry-picking one of two conflicting figures.

**Analogy seed:** Provenance is evidence chain-of-custody. A lab result without its labeled bag and timestamps is inadmissible — no matter how good the lab work was.

---

### Hour 12 — Agent Pattern: Orchestrator-Workers

**Objectives:** Recognize when to break a task into parallel/sequential worker calls. Manage the context boundary.

**Topics:**
- Coordinator decomposes a task → spawns workers (sub-prompts or subagents) → aggregates results.
- Hub-and-spoke shape: coordinator has the full picture, workers have isolated context.
- Why workers don't share each other's context (and why that's a feature).
- Parallel vs sequential dispatch.
- Simple classification routing ("which queue does this belong to?") is the degenerate single-level case of this pattern — a coordinator that only routes. (Absorbs the old Router hour.)
- The coordinator's iterative refinement loop: evaluate synthesis output for gaps → re-delegate targeted queries to search/analysis workers → re-synthesize until coverage is sufficient.
- Dynamic subagent selection: analyze the query and invoke only the subagents it needs, instead of always running the full pipeline.
- Structured handoff summaries for human escalation: customer ID, root cause, amounts, recommended action — the human has no access to the transcript.

**Friction zones:** Assuming workers can see each other's outputs. Forgetting to pass context the worker needs (workers don't inherit history automatically). Letting the coordinator try to do everything itself. Decomposition so narrow it leaves coverage gaps between workers (the exam's favorite root-cause question). Escalating to a human with no structured handoff.

**Analogy seed:** A general contractor on a build site. They don't lay every brick — they hire specialists, hand each one a scoped job and the info they need, then assemble the work.

---

### Hour 13 — Agent Pattern: Evaluator-Optimizer

**Objectives:** Recognize when iterative refinement is the right shape. Avoid infinite loops.

**Topics:**
- One agent produces, another evaluates, the producer revises. Loop until quality threshold or iteration cap.
- When this beats one-shot generation (high-quality writing, code with specific constraints).
- Multi-instance review: why a *second* Claude instance with no prior context catches things the first one won't.
- Stopping criteria: explicit quality threshold + hard iteration cap.

**Friction zones:** Conflating "extended thinking" with "self-review" — these are not the same. No stopping criterion → infinite loop. Letting the same instance review its own work.

**Analogy seed:** Writing a paper, then having a fresh reader mark it up, then revising. The fresh reader catches what you can't because you're too close to it.

---

### Hour 14 — Week 2 Consolidation + Mini-Mock

**Objectives:** Synthesize MCP + agent patterns into one scenario. Take a 10-question mini-mock. Patch any concept under 70%.

**Topics:**
- Scenario walkthrough: design a research agent that uses an MCP server to query internal docs, decomposes the query into parallel sub-searches, and self-reviews the synthesis before delivering.
- Mini-mock from `question-bank.md` → **Week 2 Mini-Mock**.
- Targeted remediation.

**Friction zones:** Whatever surfaced this week.

---

## Week 3 — Enterprise Architecture & Security (Hours 15–19)

### Hour 15 — Data Privacy & PII Handling

**Objectives:** Apply the right pattern for handling PII in agent flows. Distinguish redaction from policy enforcement.

**Topics:**
- Where PII enters an agent system (user input, tool results, fetched docs).
- Redaction at boundaries vs hoping the model "behaves".
- Log hygiene — PII in observability is still PII.
- Data residency and what gets sent where.

**Friction zones:** Trusting the system prompt to "not leak PII". Logging full prompts including PII. Forgetting that tool results can also contain PII.

**Analogy seed:** PII is like food allergens. You don't tell the chef "be careful" and hope — you remove the allergen at the supplier level, or you label everything and gate it at the kitchen door.

---

### Hour 16 — Prompt Injection Mitigation

**Objectives:** Recognize prompt injection vectors. Apply layered defenses.

**Topics:**
- Direct injection (user input) vs indirect (fetched docs, tool results, emails).
- Why "just tell the model to ignore instructions" fails.
- Defense layers: input filtering, output filtering, tool-result quoting, hooks/gates on dangerous actions, principle of least privilege on tools.
- The "untrusted content" frame: any content from outside the user message is untrusted.

**Friction zones:** Believing the system prompt is a guardrail. Granting tools broader permissions than the task needs. No interception on dangerous actions.

**Analogy seed:** Prompt injection is like a stranger slipping a note into your kid's lunchbox. "Tell them not to read notes from strangers" doesn't work. You inspect what goes in the lunchbox.

---

### Hour 17 — Guardrails: Multi-Layer Defense

**Objectives:** Stack programmatic guardrails. Distinguish guidance (prompts) from enforcement (code).

**Topics:**
- `PreToolUse` and `PostToolUse` hooks — programmatic interception.
- Tool gating: blocking `process_refund` until `verify_identity` has succeeded.
- Output filters / classifiers as a final layer.
- Why programmatic enforcement beats prompt-based "never do X" rules.
- The exam's favorite distractor: "add a sentence to the system prompt."

**Friction zones:** Reaching for system prompt wording when a hook is the right answer. Stacking only one layer. Not knowing where in the lifecycle the hook fires.

**Analogy seed:** Telling your kid "don't touch the stove" is guidance. Installing a child lock is enforcement. Guidance helps; enforcement guarantees.

---

### Hour 18 — Prompt Caching Deep Dive

**Objectives:** Structure a prompt so the cache hits. Estimate cache savings. Know cache breakpoint rules.

**Topics:**
- How prompt caching works: long-stable content at the top, volatile content at the bottom.
- `cache_control` breakpoints — where you can place them and how many.
- TTL behavior.
- Cost math: cache writes vs cache reads vs uncached input.
- When caching doesn't help (highly variable prompts, very short prompts).

**Friction zones:** Putting volatile content (user message) above stable content (system prompt). Setting too many breakpoints. Not measuring actual cache hit rate.

**Analogy seed:** Barista example from earlier. The stable part — your usual order — is what gets memorized. The variable part — "extra hot today" — stays per-order.

---

### Hour 19 — Prompt Engineering Optimization for Production

**Objectives:** Apply few-shot, chain-of-thought, and prompt chaining where appropriate. Know when each helps.

**Topics:**
- Few-shot prompting: when 2 examples beats 1 instruction.
- Chain-of-thought: explicit step-by-step vs trusting extended thinking.
- Prompt chaining: fixed sequence vs adaptive decomposition.
- Measuring and iterating on prompts in production.
- Common smell: a 2000-word system prompt that could be 200 with two good examples.

**Friction zones:** Adding more rules instead of adding examples. CoT prompts when extended thinking would do better. Treating prompts as write-once.

**Analogy seed:** Teaching by example beats teaching by manual every time. "Make me a sandwich like this one" works; "Section 4.2.1: bread orientation rules" doesn't.

---

## Week 4 — Agentic Architecture Deep-Dive & Exam Simulation (Hours 20–23)

### Hour 20 — Multi-Agent Orchestration (Hub & Spoke)

**Objectives:** Design a hub-and-spoke multi-agent system. Spawn isolated subagents correctly and run them in parallel. Manage the context boundary between coordinator and subagents.

**Topics:**
- Hub-and-spoke: a central coordinator delegates scoped subtasks to specialized subagents.
- Spawning subagents with the **Task** tool — `allowedTools` must include `'Task'` or no subagent ever spawns.
- Parallel execution: emit multiple `Task` calls in a single assistant response to run subagents concurrently.
- Context isolation: subagents have their own context and do not share state directly — a feature, not a bug.
- Passing explicit, scoped context to each subagent vs. dumping the coordinator's full history (context pollution).
- `fork_session` for isolated parallel exploration without polluting the main context.

**Friction zones:** Forgetting `'Task'` in `allowedTools`. Forwarding the coordinator's entire history to every subagent (slow, costly, off-topic). Assuming subagents can see each other's outputs. Overly narrow decomposition that leaves coverage gaps between subagents.

**Analogy seed:** A newsroom editor (coordinator) hands each reporter (subagent) one scoped assignment plus just the background that story needs — not the entire newsroom's notes. Reporters work in parallel and file independently; the editor assembles the issue.

---

### Hour 21 — Session Management & Workflows

**Objectives:** Resume, fork, and name sessions deliberately. Detect and mitigate stale context. Choose prompt chaining vs. dynamic adaptive decomposition based on task predictability.

**Topics:**
- `--resume` to continue a previous session with its preserved context (not a pasted summary).
- `fork_session` to branch for exploration without polluting the main line.
- Named sessions for organized, findable multi-session workflows.
- Stale context: long-running sessions accumulate superseded facts; detect drift and re-ground current state (compaction / fresh read) instead of trusting the model to notice.
- Prompt chaining (fixed, predictable steps) vs. dynamic adaptive decomposition (next step depends on findings).

**Friction zones:** Restarting work from scratch instead of `--resume`. Confusing `fork_session` (branch exploration) with `--resume` (continue the same line). Ignoring stale context in extended sessions. Forcing a static prompt chain onto a task that needs to adapt.

**Analogy seed:** `--resume` is reopening a saved game exactly where you stopped; `fork_session` is a "what-if" save slot you can abandon; a named session is the labeled save file you can find later. Stale context is trusting a map that was redrawn an hour ago.

---

### Hour 22 — Full Mock Exam #1 + Remediation

**Objectives:** Take a timed full-length mock. Identify the weakest domain. Targeted remediation.

**Topics:**
- 60-question timed mock from `question-bank.md` → **Mock 1**.
- Score by domain (Agentic / Tool & MCP / Claude Code / Prompts / Context).
- Spend the rest of the hour on the lowest-scoring domain.

**Friction zones:** Spending too long on early questions and running out of time. Reading distractors before the stem.

---

### Hour 23 — Full Mock Exam #2 + Final Review + Exam Strategy

**Objectives:** Validate exam readiness. Lock in test-day strategy.

**Topics:**
- Second 60-question timed mock from `question-bank.md` → **Mock 2**.
- Compare to Mock 1: trajectory matters. Improving on weakest domain is the success signal.
- Exam-day strategy: pacing (2 min/question), distractor analysis, when to mark and skip, no penalty for guessing so leave nothing blank.
- Final state update: mark the sprint complete.

**Friction zones:** Test anxiety. Second-guessing locked-in answers.

---

## Calibration Rules

Apply after each weekly mini-mock and before the Hour 22 full mock:

- **Strong area (mastery ≥ 80%):** lean review only. Compress next session by 10 minutes.
- **Weak area (mastery < 60%):** add a 10-minute warm-up block to the next two sessions targeting this area.
- **Broken area (mastery < 40%):** dedicated remediation slot — borrow 20 min from the next planned session.

## Borrowing Time

If a session runs short, drop in this order (never skip the state update):

1. Wrap-up recap (the state update still happens, just no closing summary).
2. The last MCQ of a checkpoint set.
3. The "variations" section of an analogy.

Never drop: warm-up retrieval, the state update, or the first checkpoint of the hour (it's the closest gauge of comprehension).

## Catching Up

If the student misses a day:

- Do not compress two days into one hour. Spread the missed content across the next 2–3 sessions as 10-minute warm-up additions.
- If they miss more than 3 days, slip the exam date by a week and re-anchor the curriculum from the current day forward. Update the state file accordingly.
