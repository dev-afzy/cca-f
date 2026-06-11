export type ConceptSeed = {
  slug: string;
  name: string;
  week: number;
  domain: string;
  sortOrder: number;
};

export const CONCEPT_SEED: ConceptSeed[] = [
  { slug: "model-selection",          name: "Model Selection (Haiku/Sonnet/Opus)",                  week: 1, domain: "Agentic",     sortOrder: 10 },
  { slug: "context-window-mgmt",      name: "Context Window Management",                            week: 1, domain: "Context",     sortOrder: 20 },
  { slug: "token-mechanics-cost",     name: "Token Mechanics & Cost",                               week: 1, domain: "Context",     sortOrder: 30 },
  { slug: "structured-outputs",       name: "Structured Outputs (JSON Mode)",                       week: 1, domain: "Prompts",     sortOrder: 40 },
  { slug: "tool-calling-mechanics",   name: "Tool Calling Mechanics",                               week: 1, domain: "Tool & MCP",  sortOrder: 50 },
  { slug: "tool-calling-patterns",    name: "Tool Calling Patterns",                                week: 1, domain: "Tool & MCP",  sortOrder: 60 },
  { slug: "mcp-architecture",         name: "MCP Architecture (Transport / Protocol / Lifecycle)",  week: 2, domain: "Tool & MCP",  sortOrder: 110 },
  { slug: "mcp-primitives",           name: "MCP Primitives (Tools / Resources / Prompts)",         week: 2, domain: "Tool & MCP",  sortOrder: 120 },
  { slug: "stateful-tools-security",  name: "Stateful Custom Tools & Security",                     week: 2, domain: "Tool & MCP",  sortOrder: 130 },
  { slug: "skill-vs-tool",            name: "Skill vs Tool boundary",                               week: 2, domain: "Claude Code", sortOrder: 140 },
  { slug: "agent-pattern-router",     name: "Agent Pattern: Router",                                week: 2, domain: "Agentic",     sortOrder: 150 },
  { slug: "agent-pattern-orch",       name: "Agent Pattern: Orchestrator-Workers",                  week: 2, domain: "Agentic",     sortOrder: 160 },
  { slug: "agent-pattern-eval",       name: "Agent Pattern: Evaluator-Optimizer",                   week: 2, domain: "Agentic",     sortOrder: 170 },
  { slug: "agentic-loop-termination", name: "Agentic Loop & Termination (stop_reason)",             week: 2, domain: "Agentic",     sortOrder: 180 },
  { slug: "data-privacy-pii",         name: "Data Privacy / PII Handling",                          week: 3, domain: "Claude Code", sortOrder: 210 },
  { slug: "prompt-injection",         name: "Prompt Injection Mitigation",                          week: 3, domain: "Prompts",     sortOrder: 220 },
  { slug: "guardrails",               name: "Guardrails (Hooks, Tool Gating)",                      week: 3, domain: "Claude Code", sortOrder: 230 },
  { slug: "prompt-caching",           name: "Prompt Caching",                                       week: 3, domain: "Context",     sortOrder: 240 },
  { slug: "prompt-engineering",       name: "Prompt Engineering Optimization",                      week: 3, domain: "Prompts",     sortOrder: 250 },
  { slug: "multi-agent-orchestration", name: "Multi-Agent Orchestration (Hub & Spoke)",             week: 4, domain: "Agentic",     sortOrder: 410 },
  { slug: "session-management",       name: "Session Management & Workflows",                       week: 4, domain: "Agentic",     sortOrder: 420 },
  { slug: "error-handling-resp",      name: "Error Handling Responsibility",                        week: 0, domain: "Agentic",     sortOrder: 310 },
  { slug: "multi-instance-review",    name: "Multi-instance Review pattern",                        week: 0, domain: "Agentic",     sortOrder: 320 },
];
