# Pedagogy — How to Teach

This file is the *how* of the skill. It contains:

1. The Child-to-Architect 4-Step Loop (the core delivery pipeline)
2. The Diagnostic Battery (3 multi-part questions for first session)
3. Diagnostic Rubrics (how to grade each question)
4. Adaptivity Rules (what to do when a student misses)
5. The Style Pivot Library (concrete templates per style)

---

## 1. The Child-to-Architect 4-Step Loop

**This is the core delivery pipeline. Run it for every new or weak concept.**

### Step 1 — The Child's Analogy (ELI5)

Open with a simple, relatable, real-world physical analogy. Two or three sentences. No jargon. The goal is for the student to *feel* the concept before they learn its name.

**Examples:**

- **MCP** → "MCP is like a universal plumbing adapter. Your AI app is the faucet, your tools/data are the pipes, and MCP is the standard threading that lets any faucet talk to any pipe without custom fittings."
- **Tool calling** → "Tool calling is like passing notes in class. The model writes a note ('please look up X'), your code reads the note, gets the answer, and passes a note back ('the answer is Y'). Then the conversation continues."
- **Prompt caching** → "Prompt caching is like a barista who memorizes your usual order. The first time you order, they listen to the whole thing. After that, you just say 'the usual' and they skip ahead."
- **Agentic loop** → "An agent in a loop is like a chef following a recipe but allowed to taste-test. They cook a step, taste, decide if they need to add salt or move on. The loop ends not because the timer says so but because the dish tastes done — `stop_reason: end_turn`."

### Step 2 — The API / Code Reality

Translate the analogy into actual Claude API payloads, code, or architecture. Show the *shape* of the thing.

Keep it small — a code snippet you could fit on one screen, an architecture sketch you could draw on a napkin. If it's longer than that, you're explaining too many things at once. Split it.

**Example (MCP, continued from the analogy above):**
```json
// MCP server advertises a tool
{
  "name": "get_weather",
  "description": "Get current weather for a city",
  "inputSchema": { "type": "object", "properties": { "city": {"type": "string"} } }
}

// The Claude API consumer sees it via the host, then calls it
// just like any other tool. No custom integration code.
```

### Step 3 — The Architectural Case Study

Elevate the concept to an enterprise production scenario. Force the student to reason about scale, latency, cost, reliability, or security tradeoffs.

**Pattern to use:**

> "Now we're scaling this for 10,000 concurrent users / handling 500 GB/day / under a 200ms SLA / on a $5K/month budget. What changes? What breaks first?"

**Example (Prompt caching, continued):**

> "You're running a customer support agent that processes 100K tickets/day. Each ticket gets routed through a 50K-token system prompt full of policy docs. Without caching, you're paying for that 50K tokens 100K times every day. With prompt caching — how would you structure the prompt so the cache hits? Where does the cache *not* help?"

### Step 4 — The Exam Checkpoint

End each concept block with one realistic CCA-F-style question. Pull patterns from `question-bank.md`.

**Format:** scenario stem, four options, one correct, three plausible distractors.

**Always do this after the student answers:**

1. Ask "walk me through your reasoning" *before* revealing the correct answer. This catches lucky guesses.
2. Reveal the answer and explain *why each distractor is wrong*. Distractor analysis is the highest-leverage teaching moment — the actual exam is designed around plausible-looking wrong answers.
3. If they missed it, do not repeat the same explanation. Pivot per Adaptivity Rules below.

---

## 2. The Diagnostic Battery (First Session Only)

Present **all three** questions, then wait for the student's full set of answers. Do not grade individually.

### Question 1 — API + Tool Calling + Model Selection

> *Scenario:* You're building a customer support bot for an e-commerce site. The bot needs to look up order status from an internal database and, if the order is delayed, generate a personalized apology message. You expect 5,000 conversations per hour at peak.
>
> **a)** Which Claude model would you pick for the database-lookup classification step, and which for the apology-generation step? Why?
>
> **b)** Sketch (in pseudocode or prose) the tool definition you'd write for the database lookup. What's in `name`, `description`, and `input_schema`?
>
> **c)** When does the conversation end? What `stop_reason` are you looking for?

### Question 2 — MCP + Agent Skills Connective Tissue

> *Scenario:* Your team built an MCP server that exposes a company knowledge base with three tools: `search_kb`, `get_document`, and `summarize_section`. You also have a Claude Code "skill" file at `~/.claude/skills/legal-research/SKILL.md` that describes a workflow for legal research.
>
> **a)** What is the fundamental difference between an MCP *tool* and a Claude Code *skill*? In one sentence each.
>
> **b)** When a user asks "summarize our employment contract template", which one fires first — the skill or the MCP tools — and why?
>
> **c)** If the MCP server goes down mid-conversation, what happens to the skill's workflow? Whose responsibility is the error handling?

### Question 3 — Agentic Loop + Termination

> *Scenario:* You're building an agent that's supposed to research a topic by calling a `web_search` tool repeatedly, then write a report. Your first attempt has a bug: the agent sometimes writes the report after one search, and sometimes does 30+ searches before stopping. You wrote your loop like this (pseudocode):
> ```
> while True:
>     response = claude.messages.create(...)
>     if "done" in response.content.lower():
>         break
>     handle_tool_calls(response)
> ```
>
> **a)** Name two specific things wrong with this termination logic.
>
> **b)** What should the loop actually check to decide when to stop?
>
> **c)** Where would you put a hard cap on iterations, and why is that *also* needed even after fixing (b)?

---

## 3. Diagnostic Rubrics

For each question, grade against these signals. Don't show the rubric to the student.

### Question 1 rubric

| Signal | Strong | Weak | Broken |
|---|---|---|---|
| Model selection logic | Picks Haiku for classification, Sonnet/Opus for generation; cites latency and cost | Picks correctly but reasoning is hand-wavy | Picks one model for everything, or reverses the choice |
| Tool definition shape | Names all three fields, gives realistic schema | Names fields but vague on `description` purpose | Doesn't know there's an `input_schema` |
| Termination understanding | Names `stop_reason: end_turn` | Says "when it's done" without naming the field | Talks about parsing the text |

### Question 2 rubric

| Signal | Strong | Weak | Broken |
|---|---|---|---|
| Tool vs Skill | Tool = server-side capability advertisement; Skill = model-side workflow instructions/context | Confuses the layers, says they're "kind of similar" | Treats them as the same thing |
| Trigger order | Skill triggers based on description matching the user request; tools are invoked *from within* the workflow if needed | Gets the order but can't explain why | Thinks tools trigger skills or vice-versa |
| Error responsibility | The agent loop / host handles MCP errors and may surface to the skill | Mentions error handling vaguely | No concept of who owns the error |

### Question 3 rubric

| Signal | Strong | Weak | Broken |
|---|---|---|---|
| Two specific bugs | Names: (1) parsing natural-language signals is unreliable, (2) no iteration cap | Names one bug | Names neither |
| Correct termination | `stop_reason == "end_turn"` (or equivalent — checking the structured field, not text) | Says "check if the model is done" without naming the field | Suggests stricter text matching |
| Why a hard cap | Even with correct `stop_reason`, runaway loops can occur from model confusion, cost blow-up, infinite tool retries | Mentions cost or safety vaguely | Doesn't see why a cap is also needed |

### Scoring

Mark each signal `S/W/B`. Compute initial mastery scores per concept area:

- **Model Selection**: S=80%, W=50%, B=20%
- **Tool Calling Mechanics**: S=80%, W=50%, B=20%
- **Agentic Loop & Termination**: S=80%, W=50%, B=15% (this is high-frequency exam content — broken here is a red flag)
- **MCP Fundamentals**: S=75%, W=45%, B=20%
- **Skill vs Tool boundary**: S=75%, W=40%, B=15% (common confusion)
- **Error Handling Responsibility**: S=70%, W=40%, B=20%

Seed these into the `[Concept Mastery]` section of the student ledger.

---

## 4. Adaptivity Rules — What To Do When They Miss

A missed checkpoint is a signal to **change the delivery style**, not to repeat. Here is the explicit pivot table.

| Last delivery style | What they missed on | Pivot to |
|---|---|---|
| Abstract explanation | Concept identity | Concrete code snippet |
| Code snippet | What the code is *doing* | Physical-world analogy |
| Physical-world analogy | How it applies in practice | Production scenario |
| Production scenario | Which option is right | Side-by-side compare (two designs, ask which) |
| Compare-and-contrast | Why one is wrong | Misconception confrontation (state the wrong belief, show the production failure) |
| Misconception confrontation | The deeper principle | Socratic ladder (leading questions until they derive it) |
| Socratic ladder | Forming the answer | Worked example (you walk it; then erase and have them redo) |
| Worked example | Recall under pressure | Spaced-repetition (revisit in next session's warm-up) |

**Hard rule:** never apply the same style twice in a row on the same sub-topic. Two consecutive misses → switch sub-topic and add it to `[Weak Areas]` for tomorrow's warm-up.

---

## 5. Style Pivot Library — Concrete Templates

### Side-by-side compare

> "Two designs for guaranteeing 'no refunds over $500'.
> Design X: A sentence in `CLAUDE.md` saying 'Never process refunds over $500.'
> Design Y: A `PreToolUse` hook on `process_refund` that denies when `amount > 500`.
> Which ships to production? Why?"
>
> (Student picks. You probe. Reveal Y. Articulate *why X is unreliable specifically*.)

### Misconception confrontation

> "A lot of people believe extended thinking is equivalent to a self-review pass. Here's where that belief breaks in production: [walk through a concrete failure]. The principle is..."

### Socratic ladder

Sequence of 3–5 leading questions where each answer builds toward the principle. You almost never *tell* — you ask.

Example for "why isn't extended thinking a substitute for multi-instance review?":
1. "What context does a Claude session carry forward when reviewing code it just wrote?"
2. "If extended thinking lets the model 'think more', does that change what context it has?"
3. "When you've written something hard, why is your own re-read worse at catching bugs than a colleague's read?"
4. "So what does an *independent* Claude instance bring that the original can't?"

By question 4 the student has derived the principle. Ask them to state it in their own words.

### Worked example

Step-by-step walkthrough of a non-trivial example, showing every micro-decision. Then erase the answer and have the student redo it from scratch.

### Spaced repetition (warm-up)

At the start of the next session, before today's lesson, ask 2–3 short questions on previously-missed topics. If they nail them this time, promote the topic out of weak areas. If they miss again, the topic gets a dedicated 10-minute remediation block at the end of today's session.
