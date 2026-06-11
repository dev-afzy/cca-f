export type QuestionSeed = {
  slug: string;
  conceptSlug: string;
  domain: string;
  stem: string;
  options: Record<string, string>;
  correctKey: string;
  distractorReasons: Record<string, string>;
};

export const QUESTION_SEED: QuestionSeed[] = [
  {
    slug: "model-selection-router-haiku",
    conceptSlug: "model-selection",
    domain: "Agentic",
    stem: "A customer-support agent receives 8,000 chats per hour. The first step is routing each chat to one of 12 specialist queues (refund, shipping, technical, etc.). You're currently using Opus for routing and your p95 routing latency is 3.4 seconds. Cost is also blowing past budget. Which change most effectively addresses both issues without sacrificing routing accuracy?",
    options: {
      A: "Switch the router to Haiku and add a small set of routing examples in the system prompt",
      B: "Keep Opus as the router but enable prompt caching on the large system prompt to bring the per-chat cost down",
      C: "Move routing to Sonnet as a middle-ground model and raise max_tokens so it has more room to classify cleanly",
      D: "Keep Opus as the primary router but add a regex-based classifier fallback that fires whenever Opus exceeds the latency budget",
    },
    correctKey: "A",
    distractorReasons: {
      A: "Correct. Routing is a classification task where Haiku with good examples is faster and cheaper while maintaining accuracy.",
      B: "Caching helps cost but not latency much; Opus is still the bottleneck for routing speed.",
      C: "Moving to Sonnet is a half-measure that doesn't fully address either cost or latency at scale.",
      D: "Adding a regex fallback introduces brittleness and doesn't fix the root cause of using too heavy a model.",
    },
  },
  {
    slug: "tool-calling-termination-stop-reason",
    conceptSlug: "agentic-loop-termination",
    domain: "Agentic",
    stem: "Your agent has a tool-use loop that sometimes terminates after one tool call and sometimes runs through 40+ before stopping. Your loop's exit condition is `if \"done\" in response.content.lower(): break`. The on-call engineer wants this fixed today. What change most effectively addresses the root cause?",
    options: {
      A: "Add a system prompt instruction telling the model to say \"I am done\" only when it is genuinely finished with the task",
      B: "Switch the termination check to `response.stop_reason == \"end_turn\"` and add an iteration cap as a backstop",
      C: "Add richer tool descriptions so the model has enough information to decide on its own when the work is actually complete",
      D: "Increase max_tokens so the model always has more room to reason its way to a natural stopping point on each turn",
    },
    correctKey: "B",
    distractorReasons: {
      A: "This doubles down on the same broken approach — parsing text output is the bug, not the phrasing.",
      B: "Correct. Parsing text is the bug. Check the structured field. The iteration cap is a defense-in-depth backstop.",
      C: "Tool descriptions affect tool selection, not loop termination; tangential to the root cause.",
      D: "More tokens does not fix a broken termination check; the model isn't running out of space.",
    },
  },
  {
    slug: "mcp-vs-skill-trigger-order",
    conceptSlug: "skill-vs-tool",
    domain: "Claude Code",
    stem: "Your team has built an MCP server exposing `search_kb`, `get_document`, and `summarize_section` tools. You also have a Claude Code skill at `~/.claude/skills/legal-research/SKILL.md` describing a workflow for legal research. A user asks \"find precedent for non-compete enforcement in California.\" What is the correct understanding of how these two layers interact?",
    options: {
      A: "The MCP server triggers first, because registered tools always take priority over skills whenever both could match the request",
      B: "The skill is purely documentation for humans; the MCP tools always fire on their own regardless of whether the skill is present",
      C: "The skill and the MCP tools both fire in parallel, and the host merges their two separate result streams into one response",
      D: "The skill description matches the request first; once active, the skill's workflow invokes the MCP tools as it needs them",
    },
    correctKey: "D",
    distractorReasons: {
      A: "This reverses the layer order — skills are model-side workflow descriptions selected by description match, they layer above tools.",
      B: "Skills are not purely documentation; they are active workflow descriptions that guide how the model proceeds.",
      C: "Skills and tools do not fire in parallel; the skill activates first and then orchestrates tool calls.",
      D: "Correct. Skills are model-side workflow descriptions selected by description match. Tools (including MCP tools) are invoked from within the workflow when needed.",
    },
  },
  {
    slug: "guardrails-pretooluse-hook",
    conceptSlug: "guardrails",
    domain: "Claude Code",
    stem: "Your agent must never process refunds over $500 without human approval. The CTO has reviewed three proposals. Which one ships?",
    options: {
      A: "Add a line to CLAUDE.md instructing the agent never to process refunds over $500 without explicit human approval first",
      B: "Add the no-refunds-over-$500 rule to the system prompt, reinforced with three worked examples of the correct behavior",
      C: "Add a PreToolUse hook on process_refund that denies when amount > 500 and emits a human-review request",
      D: "Train a classifier to detect refund requests above $500 in user messages and prepend a warning to the system prompt",
    },
    correctKey: "C",
    distractorReasons: {
      A: "CLAUDE.md instructions are guidance, not enforcement — they can be drifted, jailbroken, or routed around.",
      B: "System prompt rules are guidance; they can be overridden by clever user input or model drift.",
      C: "Correct. Programmatic interception is enforcement. The other three are all variations of prompt-as-guardrail.",
      D: "A classifier that modifies the system prompt is still a soft guardrail — it doesn't prevent the action programmatically.",
    },
  },
  {
    slug: "prompt-caching-breakpoint-placement",
    conceptSlug: "prompt-caching",
    domain: "Context",
    stem: "You're paying $14,000/month in input token costs. Most of your usage is a customer-support agent with a 30K-token policy document at the top of every prompt, followed by a ~500-token conversation history that varies per chat. Which restructure gives the largest savings?",
    options: {
      A: "Truncate the 30K-token policy document down to just the most-cited 5K tokens to shrink the per-request input cost",
      B: "Keep the structure but enable prompt caching with a cache_control breakpoint after the policy document",
      C: "Move the policy document to the end of the prompt so the recency effect helps the cache hold on to it",
      D: "Switch this workflow from Sonnet to Haiku so the same volume of input tokens costs noticeably less per chat",
    },
    correctKey: "B",
    distractorReasons: {
      A: "Truncating the policy document may hurt answer quality and doesn't leverage caching to reduce costs.",
      B: "Correct. Cache the stable, expensive top of the prompt. The volatile conversation history below it doesn't poison the cache.",
      C: "This reverses the caching rule — stable content must go at the top so the cache breakpoint covers it.",
      D: "Switching models might help cost but doesn't guarantee quality and isn't a caching answer to this specific problem.",
    },
  },
  {
    slug: "agent-pattern-orchestrator-decomp",
    conceptSlug: "agent-pattern-orch",
    domain: "Agentic",
    stem: "You're building a code-review agent. It must analyze a 200-file PR, flag issues in each file locally, then identify cross-file consistency problems. You're seeing degraded quality when the agent tries to do both in one pass — it misses subtle cross-file issues. Which architectural change most effectively addresses this?",
    options: {
      A: "Increase the model's context window allocation and pass all 200 files in a single prompt so it can see everything at once",
      B: "Switch the single-pass agent to Opus so it has the reasoning capacity to handle all 200 files together in one shot",
      C: "Decompose into two passes: per-file subagents for local issues + a separate integration pass for cross-file analysis",
      D: "Add a longer system prompt with explicit instructions to check both per-file issues and cross-file consistency problems",
    },
    correctKey: "C",
    distractorReasons: {
      A: "Attention dilution across 200 files is the problem; more context window makes it worse, not better.",
      B: "Opus throws resources at a structural problem without changing the architecture; still suffers attention dilution.",
      C: "Correct. Orchestrator-worker decomposition fixes attention dilution structurally — per-file workers + a separate integration pass.",
      D: "A longer system prompt is prompt-as-fix for an architecture problem; it doesn't change how the model allocates attention.",
    },
  },

  // ─── Multi-Agent Orchestration (Hub & Spoke) ───────────────────────────────
  {
    slug: "multi-agent-task-tool-parallel",
    conceptSlug: "multi-agent-orchestration",
    domain: "Agentic",
    stem: "You're building a research agent with the Claude Agent SDK. A coordinator must fan out 6 independent document-summarization jobs and you want them to run concurrently as isolated subagents. The coordinator's `allowedTools` is `['Read', 'Grep']` and you emit the 6 sub-jobs as six separate sequential assistant turns. Subagents never spawn and the work all runs in one context. What is the correct fix?",
    options: {
      A: "Add `'Task'` to the coordinator's `allowedTools` and emit the six sub-jobs as six `Task` calls in a single assistant response so they run in parallel",
      B: "Increase `max_tokens` so the coordinator has enough output room to spawn all six subagents in one turn and still collect and return every summary",
      C: "Lower the sampling temperature so the coordinator behaves more deterministically and reliably chooses to delegate each of the six jobs to a subagent",
      D: "Pass all six documents in a single prompt and instruct the coordinator to work through and summarize each of them in turn within its own context",
    },
    correctKey: "A",
    distractorReasons: {
      A: "Correct. Spawning subagents requires the `Task` tool in `allowedTools`, and multiple `Task` calls in a single response are what enable parallel subagent execution.",
      B: "`max_tokens` controls output length, not the ability to spawn subagents — the missing `Task` permission is the blocker.",
      C: "Temperature affects sampling, not delegation capability or parallelism; it doesn't explain why subagents never spawn.",
      D: "This abandons the multi-agent design and reintroduces the single-context attention dilution you set out to avoid.",
    },
  },
  {
    slug: "multi-agent-context-delegation",
    conceptSlug: "multi-agent-orchestration",
    domain: "Agentic",
    stem: "A hub-and-spoke coordinator delegates a \"check the deploy config\" subtask to a specialist subagent. To \"be safe,\" the coordinator forwards its entire 80K-token conversation history — every prior subtask, unrelated tool outputs, the full plan — into the subagent's prompt. The subagent's answers are slow, expensive, and increasingly off-topic. What is the best correction?",
    options: {
      A: "Forward even more of the coordinator's context, including the full plan and every prior subtask result, so the subagent has the complete picture first",
      B: "Tell the subagent in its system prompt to simply ignore the parts of the forwarded context that aren't relevant to checking the deploy config",
      C: "Switch the subagent to Opus so it has the capacity to handle the much larger forwarded context without slowing down or drifting off topic",
      D: "Pass the subagent only the explicit, scoped context its subtask needs (the config files and the specific question), not the coordinator's full history",
    },
    correctKey: "D",
    distractorReasons: {
      A: "More context worsens the problem — context pollution is exactly why the subagent is slow, costly, and off-topic.",
      B: "Instructing the model to \"ignore\" noise is soft guidance — the reliable fix is to not send the noise in the first place.",
      C: "A bigger model throws resources at a context-hygiene problem; it doesn't stop the pollution and raises cost further.",
      D: "Correct. Subagents need explicit, scoped context. Dumping the coordinator's full history pollutes their context and degrades focus, speed, and cost.",
    },
  },
  {
    slug: "multi-agent-decomposition-gaps",
    conceptSlug: "multi-agent-orchestration",
    domain: "Agentic",
    stem: "A coordinator splits \"audit this 12-file service for security issues\" into 12 subagents — one per file — each told only \"report vulnerabilities in your file.\" Every per-file report comes back clean, yet a real bug ships: a token minted in `auth.ts` is trusted without re-validation in `handler.ts`. What is the root cause and best fix?",
    options: {
      A: "The decomposition is too narrow — per-file workers can't see cross-file interactions, so issues at the seams fall through. Add an integration pass (or overlap scopes) whose job is reasoning about how files interact",
      B: "Switch every subagent to Opus so each one individually has the reasoning capacity to catch even subtle vulnerabilities — though each still only ever sees the single file it was assigned, never how two files interact",
      C: "Add an instruction like \"also look closely for authentication and token-validation bugs\" to every per-file subagent's prompt",
      D: "Decompose even finer — assign one subagent per function instead of per file — on the theory that more granular scopes find more issues",
    },
    correctKey: "A",
    distractorReasons: {
      A: "Correct. Overly narrow per-file decomposition leaves coverage gaps at the seams; cross-file issues need a worker whose scope spans the interaction (an integration pass), not just more isolated workers.",
      B: "A more capable worker still can't see a file it was never given — the gap is the scoping, not worker intelligence.",
      C: "Each worker still sees only one file, so the instruction can't surface an interaction between two files no single worker ever holds together.",
      D: "Finer decomposition widens the seams — more isolated scopes mean more cross-boundary interactions that no worker owns.",
    },
  },
  {
    slug: "multi-agent-fork-session-explore",
    conceptSlug: "multi-agent-orchestration",
    domain: "Agentic",
    stem: "Mid-session, your agent needs to try three competing refactor strategies and compare them, but you must not pollute the main session's context with the two abandoned attempts. Which approach best fits?",
    options: {
      A: "Run all three refactor attempts inline in the main session, then delete the two failed branches from the conversation history once you've picked a winner",
      B: "Spin up three brand-new, unrelated sessions from scratch and manually copy the relevant state back and forth between them as you compare",
      C: "Use `fork_session` to branch the session for each exploratory attempt, keeping the main context clean, and carry forward only the winning result",
      D: "Lower `max_tokens` for the attempts so the two abandoned branches leave a smaller footprint in the main session's context",
    },
    correctKey: "C",
    distractorReasons: {
      A: "Inline exploration pollutes the main context with abandoned work; after-the-fact deletion is brittle and the tokens already influenced the run.",
      B: "Fresh unrelated sessions lose the shared base context and force error-prone manual state copying; forking preserves the base cheaply.",
      C: "Correct. `fork_session` branches from the current state for isolated exploration, so abandoned attempts never pollute the main session — you merge back only what you keep.",
      D: "Smaller outputs still land in the main context; footprint size isn't the issue — isolation is.",
    },
  },

  // ─── Session Management & Workflows ────────────────────────────────────────
  {
    slug: "session-resume-vs-fork",
    conceptSlug: "session-management",
    domain: "Agentic",
    stem: "A long-running migration agent crashed overnight after 40 tool calls. You want to continue tomorrow exactly where it left off — same accumulated context — and you also want each migration tracked under a stable, findable identifier. Which combination is correct?",
    options: {
      A: "Start a fresh session and paste a written summary of yesterday's 40 tool calls into the system prompt to re-establish the context",
      B: "Use `--resume` to continue the existing (named) session with its preserved context, relying on the named session to locate it",
      C: "Use `fork_session` to branch a brand-new exploration from scratch and pick the migration back up inside that fork",
      D: "Increase the iteration cap and simply re-run the whole migration over again from the very beginning to be safe",
    },
    correctKey: "B",
    distractorReasons: {
      A: "A pasted summary is lossy — it isn't the preserved context; `--resume` restores the actual session state.",
      B: "Correct. `--resume` continues a prior session with its context intact, and a named session gives you the stable identifier to find and resume it.",
      C: "`fork_session` is for branching parallel exploration without polluting the main line — not for resuming the same work where it stopped.",
      D: "Re-running from the start discards 40 calls of progress and wastes cost; the goal is to continue, not restart.",
    },
  },
  {
    slug: "session-stale-context",
    conceptSlug: "session-management",
    domain: "Agentic",
    stem: "An agent has run for 6 hours across 300 turns. It begins citing a config value that was true early in the session but was changed by a tool call two hours ago, producing confidently wrong recommendations. What is the root-cause-aligned fix?",
    options: {
      A: "Trust the model to notice the newer value on its own, since the updated value is technically still present somewhere in the long context window from the tool call two hours ago",
      B: "Add an instruction like \"always use the most recent value\" to the system prompt and rely on it to override any stale facts still sitting in context",
      C: "Raise the temperature so the model is more likely to consider the alternative, more recent value when it answers",
      D: "Detect and mitigate stale context — compact/refresh the session so superseded facts are re-grounded (e.g., re-read current state) instead of relying on buried early-session text",
    },
    correctKey: "D",
    distractorReasons: {
      A: "Long sessions accumulate stale context the model anchors on; assuming it self-corrects is the very failure mode here.",
      B: "A prompt instruction can't reach back and refresh buried, superseded context — you must re-ground the state, not just ask nicely.",
      C: "Temperature changes sampling randomness, not which facts are current; it won't reliably surface the updated value.",
      D: "Correct. The fix is active stale-context management — detect drift and re-ground current state (compaction / fresh read) so superseded facts don't drive answers.",
    },
  },
  {
    slug: "session-chaining-vs-dynamic",
    conceptSlug: "session-management",
    domain: "Agentic",
    stem: "You're designing two workflows. Workflow A: invoice OCR → extract fields → validate → store (the same fixed steps every time). Workflow B: an open-ended incident-investigation agent whose next step depends entirely on what the previous step found. How should you structure each?",
    options: {
      A: "Use dynamic adaptive decomposition for both workflows, on the principle that maximum flexibility is always the safer default choice",
      B: "Use a static, fixed prompt chain for both workflows, since fixed chains are simpler to build, test, and debug",
      C: "Use a fixed prompt chain for A (predictable, fixed steps) and dynamic adaptive decomposition for B (next step depends on findings)",
      D: "Merge both workflows into a single mega-prompt and let the model figure out the entire control flow on its own",
    },
    correctKey: "C",
    distractorReasons: {
      A: "Dynamic decomposition adds cost and nondeterminism that a fixed, predictable pipeline like A doesn't need.",
      B: "A static chain can't handle B, where the path isn't known in advance — forcing a fixed sequence breaks on the first branch.",
      C: "Correct. Predictable fixed-step tasks fit prompt chaining; tasks whose next step depends on prior findings need dynamic adaptive decomposition.",
      D: "A single mega-prompt loses the structure and observability of explicit steps and still doesn't solve B's need to adapt.",
    },
  },

  // ─── Agentic Loop & Core API (tool-result appending, SDK control flow) ──────
  {
    slug: "agentic-loop-tool-result-append",
    conceptSlug: "agentic-loop-termination",
    domain: "Agentic",
    stem: "You're hand-implementing an agentic loop. After the model returns a `tool_use` block, your code runs the tool but then sends the next request containing only the original user message plus the tool's raw output as a new user string — it does NOT append the assistant's `tool_use` block and a matching `tool_result` block to the running messages array. The model keeps re-requesting the same tool. What's wrong?",
    options: {
      A: "Each iteration must append the assistant `tool_use` turn AND a corresponding `tool_result` block to the conversation, then resend the full messages array so the model sees its call was satisfied",
      B: "You must lower `max_tokens` so the model has less room to keep repeating the same tool call over and over on every successive turn",
      C: "Switch to a more capable model like Opus, on the assumption that a stronger model will simply remember it already called the tool and move on",
      D: "Add an explicit instruction like \"do not repeat tool calls you have already made\" to the system prompt so it won't call the same tool twice",
    },
    correctKey: "A",
    distractorReasons: {
      A: "Correct. The loop advances by appending the assistant's `tool_use` and the matching `tool_result` each iteration; without that linkage the model never sees its call as fulfilled and re-requests it.",
      B: "`max_tokens` limits output length; it has nothing to do with the missing `tool_result` linkage causing the repeat.",
      C: "A bigger model can't compensate for a malformed conversation that omits the `tool_result` it needs to proceed.",
      D: "Prompt instructions can't substitute for the structured `tool_use`/`tool_result` round-trip the API requires to advance the loop.",
    },
  },
  {
    slug: "agentic-loop-sdk-control-flow",
    conceptSlug: "agentic-loop-termination",
    domain: "Agentic",
    stem: "A teammate using the Claude Agent SDK writes a manual `while` loop that, after each response, parses the assistant's prose for the word \"finished\" to decide whether to stop, and re-implements tool dispatch by hand — even though the SDK already runs the agentic loop. What is the most accurate guidance?",
    options: {
      A: "Hand-rolling the loop is required here, since the Agent SDK only ever sends and returns a single message at a time",
      B: "Set `tool_choice: any` so that the loop is given a clear and reliable signal for when it should stop iterating",
      C: "Keep the prose parsing for the word \"finished\" but also check `stop_reason` as a secondary confirmation signal",
      D: "Let the SDK drive the loop — it dispatches tools and continues while `stop_reason` is `tool_use`, terminating on `end_turn`; you supply tools and a backstop iteration cap, not prose-parsing",
    },
    correctKey: "D",
    distractorReasons: {
      A: "The Agent SDK manages the loop — tool dispatch and continuation — so reimplementing it by hand is unnecessary and error-prone.",
      B: "`tool_choice: any` forces the model to call some tool; it has nothing to do with detecting termination and would actually prevent stopping.",
      C: "Keeping prose-parsing keeps the bug — the structured `stop_reason` is the authority and should replace text inspection entirely, not supplement it.",
      D: "Correct. The SDK continues while `stop_reason` is `tool_use` and stops on `end_turn`; your job is to register tools and optionally cap iterations, not to parse text.",
    },
  },

  // ─── Guardrails (PostToolUse normalization + escalation-signal anti-patterns) ─
  {
    slug: "guardrails-posttooluse-normalize",
    conceptSlug: "guardrails",
    domain: "Claude Code",
    stem: "A `lookup_customer` tool returns phone numbers in a dozen inconsistent formats from different backends, and downstream tools choke on the variance. You want every phone number normalized to E.164 before the model or any other tool ever sees it, deterministically. Which mechanism fits best?",
    options: {
      A: "A `PostToolUse` hook that intercepts `lookup_customer` output and rewrites phone numbers to E.164 before they re-enter the conversation",
      B: "Add an instruction to the system prompt telling the model that it should always normalize every phone number it sees into the standard E.164 format",
      C: "A `PreToolUse` hook on `lookup_customer` that tries to normalize the phone numbers before the tool actually runs",
      D: "Ask the model to remember to call a separate `normalize_phone` tool after each `lookup_customer` call completes",
    },
    correctKey: "A",
    distractorReasons: {
      A: "Correct. `PostToolUse` hooks intercept and modify a tool's output for deterministic data normalization before it re-enters the conversation.",
      B: "A system-prompt instruction is probabilistic guidance — it will drift and won't guarantee every number is normalized.",
      C: "`PreToolUse` fires before the tool executes, so the output to normalize doesn't exist yet — wrong point in the lifecycle.",
      D: "Depending on the model to remember a follow-up tool call is non-deterministic; a hook enforces normalization unconditionally.",
    },
  },
  {
    slug: "guardrails-confidence-escalation",
    conceptSlug: "guardrails",
    domain: "Claude Code",
    stem: "A support agent must escalate hard tickets to a human. A proposal: ask the model to self-report a confidence score (0–1) and escalate when confidence < 0.6. In testing, the model reports 0.9 on tickets it then answers incorrectly and 0.4 on tickets it handles fine. What's the architecturally sound escalation trigger?",
    options: {
      A: "Keep the self-reported confidence score but recalibrate the escalation threshold upward, from 0.6 to around 0.75",
      B: "Escalate on deterministic, observable signals — a hook detecting a refund over a hard limit, repeated failed resolution attempts, or an explicit policy-matched category — not the model's self-reported confidence",
      C: "Ask the model to rate its own confidence twice on each ticket and escalate based on the average of the two scores",
      D: "Add an instruction like \"be honest and well-calibrated about your confidence\" to the system prompt and trust it",
    },
    correctKey: "B",
    distractorReasons: {
      A: "Model self-reported confidence is unreliable (it's high on wrong answers here); no threshold fixes a signal that doesn't track correctness.",
      B: "Correct. Escalation should hinge on deterministic, observable triggers (hard limits, failed-attempt counts, policy categories), not an unreliable self-estimate.",
      C: "Averaging two unreliable self-estimates yields another unreliable number — it still doesn't track correctness.",
      D: "Prompting for honesty can't make a model's confidence calibrated; the signal itself is the problem, not its phrasing.",
    },
  },
  {
    slug: "guardrails-sentiment-escalation",
    conceptSlug: "guardrails",
    domain: "Claude Code",
    stem: "To decide which tickets need a senior human, a team proposes escalating any ticket where a sentiment classifier flags the customer as \"angry.\" In testing, a calm customer with a complex tax-compliance question is handled by the bot and gets it wrong, while an angry customer with a trivial password reset is escalated. What's the flaw and the better design?",
    options: {
      A: "Escalate every single ticket straight to a senior human to be safe, rather than attempting to triage them at all",
      B: "Tune and retrain the sentiment classifier so that it detects customer anger far more accurately than it does today",
      C: "Sentiment is a poor proxy for complexity; escalate on complexity/risk signals (policy category, required privileges, dollar thresholds, repeated failures) and treat sentiment as at most one minor input",
      D: "Add several examples of angry customer messages to the system prompt so the model learns to escalate that kind of ticket",
    },
    correctKey: "C",
    distractorReasons: {
      A: "Escalating everything erases the triage value and overloads humans; the goal is to route by genuine complexity/risk.",
      B: "Even a perfect anger detector misroutes, because the two failing cases prove sentiment doesn't track what actually needs a human.",
      C: "Correct. Sentiment does not equal complexity or risk — route on complexity/risk signals. The calm-but-complex and angry-but-trivial cases show why sentiment misroutes.",
      D: "More prompt examples still optimize for the wrong signal (sentiment) instead of complexity/risk.",
    },
  },
];
