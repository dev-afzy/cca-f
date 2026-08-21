export type ConceptSeed = {
  slug: string;
  name: string;
  week: number;
  domain: string;
  sortOrder: number;
};

export const CONCEPT_SEED: ConceptSeed[] = [
  // Week 1 — API foundations & extraction quality
  { slug: "model-selection",            name: "Model Selection & Distractor Literacy",                week: 1, domain: "Agentic",     sortOrder: 10 },
  { slug: "context-window-mgmt",        name: "Context Window Management",                            week: 1, domain: "Context",     sortOrder: 20 },
  { slug: "batch-extraction-quality",   name: "Batch Processing & Extraction Quality",                week: 1, domain: "Prompts",     sortOrder: 30 },
  { slug: "structured-outputs",         name: "Structured Outputs (JSON Mode)",                       week: 1, domain: "Prompts",     sortOrder: 40 },
  { slug: "tool-calling-mechanics",     name: "Tool Calling Mechanics",                               week: 1, domain: "Tool & MCP",  sortOrder: 50 },
  { slug: "tool-calling-patterns",      name: "Tool Calling Patterns",                                week: 1, domain: "Tool & MCP",  sortOrder: 60 },
  // Week 2 — MCP, tools & agentic patterns
  { slug: "builtin-tool-selection",       name: "Built-in Tool Selection (Read/Write/Edit/Bash/Grep/Glob)", week: 2, domain: "Tool & MCP", sortOrder: 105 },
  { slug: "mcp-architecture",           name: "MCP Integration & Configuration",                      week: 2, domain: "Tool & MCP",  sortOrder: 110 },
  { slug: "mcp-primitives",             name: "MCP Primitives (Tools / Resources / Prompts)",         week: 2, domain: "Tool & MCP",  sortOrder: 120 },
  { slug: "tool-interface-errors",      name: "Tool Interface Design & Structured Errors",            week: 2, domain: "Tool & MCP",  sortOrder: 130 },
  { slug: "skill-vs-tool",              name: "Skill vs Tool boundary",                               week: 2, domain: "Claude Code", sortOrder: 140 },
  { slug: "error-propagation-provenance", name: "Error Propagation & Provenance",                     week: 2, domain: "Context",     sortOrder: 150 },
  { slug: "agent-pattern-orch",         name: "Agent Pattern: Orchestrator-Workers",                  week: 2, domain: "Agentic",     sortOrder: 160 },
  { slug: "task-decomposition",           name: "Task Decomposition Strategies",                        week: 2, domain: "Agentic",    sortOrder: 165 },
  { slug: "agent-pattern-eval",         name: "Agent Pattern: Evaluator-Optimizer",                   week: 2, domain: "Agentic",     sortOrder: 170 },
  { slug: "agentic-loop-termination",   name: "Agentic Loop & Termination (stop_reason)",             week: 2, domain: "Agentic",     sortOrder: 180 },
  // Week 3 — Claude Code & production workflows
  { slug: "claude-md-rules",            name: "CLAUDE.md Hierarchy & Path-Scoped Rules",              week: 3, domain: "Claude Code", sortOrder: 210 },
  { slug: "skills-commands-planmode",   name: "Slash Commands, Skills & Plan Mode",                   week: 3, domain: "Claude Code", sortOrder: 220 },
  { slug: "codebase-exploration-context", name: "Context in Large-Codebase Exploration",                week: 3, domain: "Context",    sortOrder: 225 },
  { slug: "guardrails",                 name: "Guardrails (Hooks, Tool Gating, Escalation)",          week: 3, domain: "Agentic",     sortOrder: 230 },
  { slug: "agent-sdk-hooks",            name: "Agent SDK Hooks & Data Normalization",                 week: 3, domain: "Agentic",     sortOrder: 235 },
  { slug: "cicd-refinement",            name: "Claude Code in CI/CD & Iterative Refinement",          week: 3, domain: "Claude Code", sortOrder: 240 },
  { slug: "prompt-engineering",         name: "Prompt Engineering: Explicit Criteria & Few-Shot",     week: 3, domain: "Prompts",     sortOrder: 250 },
  // Week 4 — Agentic deep-dive & exam sim
  { slug: "multi-agent-orchestration",  name: "Multi-Agent Orchestration (Hub & Spoke)",              week: 4, domain: "Agentic",     sortOrder: 410 },
  { slug: "session-management",         name: "Session Management & Workflows",                       week: 4, domain: "Agentic",     sortOrder: 420 },
  // Cross-cutting
  { slug: "human-review-calibration",     name: "Human Review Workflows & Confidence Calibration",      week: 3, domain: "Context",    sortOrder: 255 },
  { slug: "multi-instance-review",      name: "Multi-instance Review pattern",                        week: 0, domain: "Prompts",     sortOrder: 320 },
];
