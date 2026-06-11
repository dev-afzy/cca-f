# Question Bank — CCA-F-Style Questions

The real CCA-F exam is 60 scenario-based MCQs with one correct answer and three plausible distractors. The hardest part of the exam is *distractor literacy* — wrong answers are designed to look reasonable. This file is your library of patterns and exemplars for building those questions live.

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
> > B) [correct answer — usually a programmatic / structural fix]
> > C) [over-engineered alternative that would also work but is wasteful]
> > D) [plausible but tangential fix that doesn't actually address the root cause]

## Distractor Design — The Six Common Wrong Patterns

When generating questions live, build distractors using these patterns. The exam uses them constantly.

1. **Prompt-as-guardrail.** "Add a sentence to the system prompt saying X." Wrong because prompts are guidance, not enforcement.
2. **Parsing text instead of structured fields.** "Check if the response contains 'done'." Wrong because it's brittle.
3. **Bigger model is always better.** "Switch to Opus." Wrong when the actual fix is structural.
4. **Increase context window / send more history.** Wrong when the actual fix is compaction or RAG.
5. **Retry the whole thing.** Wrong when the actual fix is targeted retry on the specific failure path.
6. **One-shot bigger prompt.** "Add more examples and rules to the system prompt." Wrong when an additional structural component (hook, validator, second pass) is the right answer.

A good question will use at least two of these as distractors.

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
> **Correct: C.** Programmatic interception is enforcement. The other three are all variations of prompt-as-guardrail and can be drifted, jailbroken, or routed around.

### Prompt Caching

> *Scenario:* You're paying $14,000/month in input token costs. Most of your usage is a customer-support agent with a 30K-token policy document at the top of every prompt, followed by a ~500-token conversation history that varies per chat. Which restructure gives the largest savings?
>
> A) Truncate the policy document to the most-cited 5K tokens
> B) Keep the structure but enable prompt caching with a `cache_control` breakpoint after the policy document
> C) Move the policy document to the end of the prompt (recency effect helps cache)
> D) Switch from Sonnet to Haiku for this workflow
>
> **Correct: B.** Cache the stable, expensive top of the prompt. The volatile conversation history below it doesn't poison the cache. A hurts answer quality. C reverses the caching rule (stable content goes at the top). D might help cost but breaks no guarantees about quality and isn't a caching answer.

### Agent Pattern Choice

> *Scenario:* You're building a code-review agent. It must analyze a 200-file PR, flag issues in each file locally, then identify cross-file consistency problems. You're seeing degraded quality when the agent tries to do both in one pass — it misses subtle cross-file issues. Which architectural change most effectively addresses this?
>
> A) Increase the model's context window allocation and pass all 200 files in one prompt
> B) Switch to Opus to handle the larger reasoning load
> C) Decompose into two passes: per-file subagents for local issues + a separate integration pass for cross-file analysis
> D) Add a longer system prompt with explicit instructions to check both local and cross-file issues
>
> **Correct: C.** Attention dilution across 200 files is the problem; orchestrator-worker decomposition fixes it structurally. A and B throw resources at a structural problem. D is prompt-as-fix for an architecture issue.

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
> **Correct: B.** `--resume` continues a prior session with context intact; a named session makes it findable. A is lossy, C is for branching exploration (not resuming the same line), D throws away progress. Related traps: ignoring **stale context** in long sessions (re-ground current state), and forcing a static prompt chain onto a task that needs dynamic adaptive decomposition.

### Hooks & Escalation Signals

> *Scenario:* A support agent should escalate hard tickets. A proposal escalates when the model's self-reported confidence < 0.6, but it reports 0.9 on tickets it answers wrong and 0.4 on ones it handles fine. Sound trigger?
>
> A) Recalibrate the self-reported threshold to 0.75
> B) Escalate on deterministic, observable signals (hard-limit hook, repeated failed attempts, policy-matched category)
> C) Average two self-reported confidence scores
> D) Add "be honest about your confidence" to the system prompt
>
> **Correct: B.** Self-reported confidence is unreliable and doesn't track correctness — no threshold fixes that. Sentiment is also a poor proxy (anger ≠ complexity). Escalate on complexity/risk signals. Related: use a `PostToolUse` hook for deterministic data normalization (e.g., phone numbers → E.164) — not a system-prompt instruction, and not `PreToolUse` (output doesn't exist yet).

---

## Mini-Mock — Week 1 (Hour 7)

10 questions, ~15 minutes, covering: model selection, context window, token economics, structured outputs, tool calling mechanics, tool-choice control.

When generating live, target this mix:
- 2 on model selection
- 2 on token / context window / cost
- 2 on structured outputs
- 3 on tool calling mechanics & patterns
- 1 cross-cutting scenario

After scoring: every wrong answer triggers a remediation note in `[Weak Areas]`.

---

## Mini-Mock — Week 2 (Hour 14)

10 questions, ~15 minutes, covering: MCP architecture, MCP primitives, tool security & state, skill-vs-tool boundary, the three agent patterns, agentic loop termination.

Target mix:
- 2 on MCP architecture / primitives
- 1 on stateful / secure tool design
- 1 on skill-vs-tool boundary
- 3 on agent patterns (one each: Router, Orchestrator-Workers, Evaluator-Optimizer)
- 2 on agentic loop / stop_reason
- 1 cross-cutting scenario

---

## Full Mock 1 (Hour 22)

60 questions, 120 minutes, timed. Match the actual exam's domain weights:

| Domain | Questions |
|---|---|
| Agentic Architecture & Orchestration | 16 |
| Claude Code Configuration & Workflows | 12 |
| Prompt Engineering & Structured Output | 12 |
| Tool Design & MCP Integration | 11 |
| Context Management & Reliability | 9 |

Score by domain. Lowest-scoring domain gets the remaining session time for remediation.

Note: the user's attached curriculum is light on Claude Code Configuration content (Week 2 covers MCP and agents but not the `CLAUDE.md` hierarchy, slash commands, hooks-at-CI-boundary, plugins, permissions in depth). Flag this in `[Weak Areas]` if Claude Code domain scores low and consider supplementing.

---

## Full Mock 2 (Hour 23)

Same shape as Mock 1, different questions. Trajectory matters: improvement on Mock 1's weakest domain is the success signal.

If Mock 2 score is ≥ 80% overall AND no domain below 60%: ready to sit the real exam.
If overall < 70% OR any domain < 50%: recommend delaying the real exam by 1–2 weeks for targeted re-study.

---

## Live Generation Guidance

When you need a checkpoint question mid-session and don't want to use an exemplar above:

1. Pick the *concept* being tested.
2. Pick the *production setting* (use realistic numbers — 100K req/day, 30K-token prompt, $5K/month budget).
3. State the *specific architectural decision* to make.
4. Write four options:
   - One correct (usually structural / programmatic).
   - One prompt-as-fix distractor.
   - One bigger-model-is-better OR throw-more-tokens distractor.
   - One plausible but tangential fix.
5. After the student answers, ask "walk me through your reasoning" before revealing.
6. Reveal and dissect *every distractor* — why each one is wrong is where the learning happens.
