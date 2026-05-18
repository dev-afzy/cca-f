# Student Ledger — Template

This is the canonical shape of `~/.cca-f-tutor/student-ledger.md`. Copy it to that path on first session and fill in the fields. Update it at the end of every session before signing off.

The instructor reads this file at the start of every session and treats it as the source of truth.

---

```markdown
# CCA-F Tutor — Student Ledger

> Last updated: <YYYY-MM-DD>

## [Current Session]

- Hour: <N> / 21
- Week: <1 | 2 | 3>
- Sprint start date: <YYYY-MM-DD>
- Target exam date: <YYYY-MM-DD>          # default: sprint start + 21 days
- Days elapsed: <N>
- Days remaining in sprint: <N>
- Ledger file path: ~/.cca-f-tutor/student-ledger.md   # update if user chose elsewhere

## [Student Profile]

- Name / preferred address: <how the student likes to be called>
- Background: <brief — current role, languages, prior Claude experience>
- Prerequisites completed: Agent Skills | Claude API | MCP | Claude Code
- Time zone / typical study time: <optional>

## [Preferred Teaching Style]

Filled in / updated as signals emerge. Examples of valid entries:
- Analogy-heavy (responds well to physical-world metaphors)
- Code-heavy (prefers seeing payloads before prose)
- Scenario-heavy (engages best with production tradeoff framing)
- Terse (does not want long explanations)
- Manglish (Malayalam-English mix — student is in Kerala)
- Prose-first, minimal bullets

Current: <pick one or two as primary; add notes as needed>

## [Concept Mastery]

Track each concept area as a percentage. Update after every session that touched the area.

### Week 1 — API foundations
- Model Selection (Haiku/Sonnet/Opus): <%>
- Context Window Management: <%>
- Token Mechanics & Cost: <%>
- Structured Outputs (JSON Mode): <%>
- Tool Calling Mechanics: <%>
- Tool Calling Patterns: <%>

### Week 2 — MCP & agentic patterns
- MCP Architecture (Transport / Protocol / Lifecycle): <%>
- MCP Primitives (Tools / Resources / Prompts): <%>
- Stateful Custom Tools & Security: <%>
- Skill vs Tool boundary: <%>
- Agent Pattern: Router: <%>
- Agent Pattern: Orchestrator-Workers: <%>
- Agent Pattern: Evaluator-Optimizer: <%>
- Agentic Loop & Termination (stop_reason): <%>

### Week 3 — Enterprise & exam shape
- Data Privacy / PII Handling: <%>
- Prompt Injection Mitigation: <%>
- Guardrails (Hooks, Tool Gating): <%>
- Prompt Caching: <%>
- Prompt Engineering Optimization: <%>

### Cross-cutting
- Error Handling Responsibility: <%>
- Multi-instance Review pattern: <%>

Legend: 0–39 broken | 40–59 weak | 60–79 working | 80–100 strong.

## [Weak Areas / Friction Points]

Append every friction point as it occurs. Format:

- <YYYY-MM-DD, Hour N> — <concept> — <what specifically tripped them> — <style that helped or didn't>

Example:
- 2026-05-19, Hour 5 — Tool calling — confused tool_use with end_turn for termination — analogy helped; code snippet did not

When a topic gets 3 consecutive strong checkpoints, mark it `[RESOLVED]` and leave the historical entry as-is.

## [Strong Areas]

Append topics the student has demonstrably nailed (≥80% mastery across 2+ sessions).

- <concept> — <YYYY-MM-DD>

## [Misconceptions Log]

Active misconceptions to confront in future sessions. Different from friction points — these are *wrong models* the student believes, not just things they forgot.

- <YYYY-MM-DD> — <the wrong belief> — <date resolved or "open">

Example:
- 2026-05-20 — Thinks system-prompt rules are enforcement, not guidance — open

## [Session History]

One line per session.

| Date | Hour | Topic | Outcome |
|---|---|---|---|
| 2026-05-18 | 0 | Diagnostic | Weak on agentic loop termination, strong on model selection |
| 2026-05-19 | 1 | Model family map | Solid; ready for Hour 2 |
| 2026-05-20 | 2 | Context window mgmt | Confused window vs max_tokens; remediated |

## [Next Up]

The exact topic for the next session. Be specific.

> Hour <N+1> — <topic>. Start with <specific friction point from today> as warm-up.

## [Sprint Notes]

Free-form. Anything that doesn't fit the structured fields. Mood, life context that affects study capacity, custom commitments the student made.

---
```

## Update Discipline

At session end, **always** update these fields (in this order):

1. `[Current Session]` — increment Hour and adjust days remaining.
2. `[Concept Mastery]` — adjust every percentage that today's session touched.
3. `[Weak Areas / Friction Points]` — append today's friction points.
4. `[Strong Areas]` — promote any topic that just hit 3 consecutive strong checkpoints.
5. `[Misconceptions Log]` — add any new wrong-model beliefs; close any confronted.
6. `[Session History]` — one new row.
7. `[Next Up]` — overwrite with tomorrow's exact topic and the warm-up hook.

If you forget step 7 you'll lose the breadcrumb that lets tomorrow's session pick up where today left off. Treat it like committing code.
