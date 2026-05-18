# Curriculum — 21 Hours, 3 Weeks

Structure follows the attached blueprint: Week 1 patches API foundations, Week 2 goes deep on MCP and agents, Week 3 covers enterprise concerns and runs the mocks.

Each hour gives:
- **Objectives** (what the student should be able to do at the end)
- **Topics** (what to cover)
- **Friction zones** (where students typically stumble — watch for these)
- **Suggested analogy seeds** (starting points for the Child's Analogy step)

The instructor (you) generates the actual teaching content live, using the Child-to-Architect 4-step loop from `pedagogy.md` for every concept.

---

## Week 1 — Foundation Patching & Core API Architecture (Hours 1–7)

### Hour 1 — Diagnostic + Model Family Map

**Objectives:** Surface broken knowledge across the four prereq courses. Build a clean mental map of Haiku / Sonnet / Opus selection criteria.

**Topics:**
- Run the 3-question diagnostic battery from `pedagogy.md`.
- The model family: latency, cost, context window, capability tradeoffs.
- Selection heuristics: classifier/router → Haiku; generation/reasoning → Sonnet; planning/orchestration of complex tasks → Opus.

**Friction zones:** Confusing model size with context window size. Picking Opus "to be safe" when Haiku would meet the SLA at 1/12th the cost. Not understanding why latency matters for agentic inner loops.

**Analogy seed:** Picking a model is like picking a vehicle. Haiku is a scooter (fast, cheap, weaves through small jobs), Sonnet is a sedan (handles most trips well), Opus is a moving truck (slow and pricey but moves anything).

---

### Hour 2 — Context Window Management

**Objectives:** Distinguish context window from output tokens. Apply truncation/summarization/RAG strategies appropriately.

**Topics:**
- Context window vs `max_tokens` — they are different numbers, often confused.
- The `system` block, conversation history, message structure.
- Strategies: sliding window, summarization compaction, RAG, fact extraction.
- When the long-context approach beats RAG and when it doesn't.

**Friction zones:** Treating context window as if it's free. Sending the entire history every turn. Not knowing where to put the most cache-friendly content (long-stable docs near the top).

**Analogy seed:** Context window is like a chef's prep counter. You can only fit so much. You can put everything on it (long-context), or you can have a runner bring ingredients in just-in-time (RAG), or you can keep a tidy summary of what's already been used (compaction).

---

### Hour 3 — Token Mechanics & Cost Optimization

**Objectives:** Predict token cost roughly. Know when to escalate models. Spot caching candidates.

**Topics:**
- Tokens ≠ characters ≠ words. BPE intuition.
- Input vs output token pricing asymmetry.
- The cascade pattern (cheap model gates expensive model).
- Streaming vs non-streaming and perceived latency.
- Prompt caching is introduced as a teaser — full depth comes in Week 3.

**Friction zones:** Estimating tokens as if 1 word = 1 token. Forgetting that output tokens are often 5x more expensive than input. Not realizing you can serve 90% of requests with a cheaper model and only escalate the hard ones.

**Analogy seed:** Tokens are like packing peanuts. They take up space whether or not the box is full, and you pay by the peanut, not the box.

---

### Hour 4 — Structured Outputs (JSON Mode)

**Objectives:** Get reliable JSON from Claude. Choose between tool-calling-as-schema and prompt-engineered JSON.

**Topics:**
- Stop sequences and prefill.
- Tool definitions as a way to force schema adherence.
- Validation, retry-on-malformed patterns.
- When *not* to use structured outputs (natural-language is often better for human-facing).

**Friction zones:** Trying to coerce JSON via prompt alone when tools-as-schema is more reliable. No validation step. No retry strategy for malformed output. Over-using JSON when the downstream consumer is a human.

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

**Friction zones:** Always defaulting to `tool_choice: auto`. Not knowing `none` exists. Setting up tools for trivial prompts. Letting the model decide *whether* to use tools when you've already decided it must.

**Analogy seed:** `tool_choice` is the difference between letting the model pick its own kitchen knife (`auto`), forcing it to use *some* knife (`any`), forcing the chef's knife specifically (`tool`), or saying "no knives this time, just talk" (`none`).

---

### Hour 7 — Week 1 Consolidation + Mini-Mock

**Objectives:** Synthesize Week 1 into one architectural scenario. Take a 10-question mini-mock. Patch any concept under 70% mastery.

**Topics:**
- Scenario walkthrough: design the API layer for a customer support bot. Cover model selection, tools, structured outputs, cost.
- Mini-mock from `question-bank.md` → **Week 1 Mini-Mock**.
- Targeted remediation on any concept still scoring below 70%.

**Friction zones:** Whatever surfaced this week.

---

## Week 2 — Advanced MCP & Agentic Workflows (Hours 8–14)

### Hour 8 — MCP Architecture (Transport, Protocol, Lifecycle)

**Objectives:** Diagram the MCP three-layer model. Name what each layer is responsible for.

**Topics:**
- The host / client / server model. Who connects to whom.
- Transport layer: stdio for local, SSE/HTTP for remote.
- Protocol layer: JSON-RPC 2.0 messages, request/response/notification.
- Lifecycle: `initialize` → ready → tool/resource/prompt operations → `shutdown`.

**Friction zones:** Confusing the MCP server with the underlying tool/database. Not knowing which layer the failure happened at when something breaks.

**Analogy seed:** MCP is plumbing standards. The transport is the pipe material (copper vs PEX), the protocol is the fitting threading (standardized so any pipe connects to any fixture), and the lifecycle is the water-on/water-off ceremony.

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

### Hour 10 — Designing Secure, Stateful Custom Tools

**Objectives:** Design a tool with proper auth, session handling, idempotency, and error reporting.

**Topics:**
- Authentication patterns (API keys via env vars; OAuth for user-scoped servers; never put credentials in tool descriptions).
- Session/state: when a tool needs to remember things between calls, where state lives.
- Idempotency for safe retry.
- `is_error: true` and how the model uses error text.
- Tool descriptions: the model reads them like documentation. Vague descriptions = wrong tool calls.

**Friction zones:** Putting secrets in tool descriptions. Stateful tools that crash when called from a forked session. Tool descriptions like "does the thing" — the model has no way to choose correctly.

**Analogy seed:** A tool description is the label on a kitchen container. "Stuff" doesn't help the chef. "Flour, all-purpose, opened 3 days ago" does.

---

### Hour 11 — Agent Pattern: Router

**Objectives:** Recognize the Router pattern. Implement one. Know its failure modes.

**Topics:**
- Classify input → route to the appropriate handler/tool/sub-prompt.
- When a Router is enough (clear, mutually exclusive categories).
- Failure modes: ambiguous inputs, evolving categories, the "other" bucket.
- Confidence scoring on the route decision.

**Friction zones:** Treating every problem as a Router problem. Routing without a fallback. Not measuring router accuracy.

**Analogy seed:** A receptionist deciding which department to forward a call to. Fast, cheap, and right 90% of the time — but only as good as the menu of departments.

---

### Hour 12 — Agent Pattern: Orchestrator-Workers

**Objectives:** Recognize when to break a task into parallel/sequential worker calls. Manage the context boundary.

**Topics:**
- Coordinator decomposes a task → spawns workers (sub-prompts or subagents) → aggregates results.
- Hub-and-spoke shape: coordinator has the full picture, workers have isolated context.
- Why workers don't share each other's context (and why that's a feature).
- Parallel vs sequential dispatch.

**Friction zones:** Assuming workers can see each other's outputs. Forgetting to pass context the worker needs (workers don't inherit history automatically). Letting the coordinator try to do everything itself.

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

## Week 3 — Enterprise Architecture, Security & Exam Simulation (Hours 15–21)

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

### Hour 20 — Full Mock Exam #1 + Remediation

**Objectives:** Take a timed full-length mock. Identify the weakest domain. Targeted remediation.

**Topics:**
- 60-question timed mock from `question-bank.md` → **Mock 1**.
- Score by domain (Agentic / Tool & MCP / Claude Code / Prompts / Context).
- Spend the rest of the hour on the lowest-scoring domain.

**Friction zones:** Spending too long on early questions and running out of time. Reading distractors before the stem.

---

### Hour 21 — Full Mock Exam #2 + Final Review + Exam Strategy

**Objectives:** Validate exam readiness. Lock in test-day strategy.

**Topics:**
- Second 60-question timed mock from `question-bank.md` → **Mock 2**.
- Compare to Mock 1: trajectory matters. Improving on weakest domain is the success signal.
- Exam-day strategy: pacing (2 min/question), distractor analysis, when to mark and skip, no penalty for guessing so leave nothing blank.
- Final state update: mark the sprint complete.

**Friction zones:** Test anxiety. Second-guessing locked-in answers.

---

## Calibration Rules

Apply after each weekly mini-mock and before the Hour 20 full mock:

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
