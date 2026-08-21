/**
 * Token usage types and helpers for billing calculations.
 * Pure math module — no server-only imports, fully testable.
 */

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
};

export type ModelUsage = TokenUsage & {
  model: string;
};

export const ZERO_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
};

/**
 * Convert SDK usage object to our TokenUsage type.
 * Defensively null-coalesce each field to 0.
 */
export function fromSdkUsage(u: unknown): TokenUsage {
  if (!u || typeof u !== "object") {
    return ZERO_USAGE;
  }

  const obj = u as Record<string, unknown>;

  return {
    inputTokens: typeof obj.input_tokens === "number" ? obj.input_tokens : 0,
    outputTokens: typeof obj.output_tokens === "number" ? obj.output_tokens : 0,
    cacheCreationTokens:
      typeof obj.cache_creation_input_tokens === "number"
        ? obj.cache_creation_input_tokens
        : 0,
    cacheReadTokens:
      typeof obj.cache_read_input_tokens === "number"
        ? obj.cache_read_input_tokens
        : 0,
  };
}

/**
 * Field-wise sum of two TokenUsage objects.
 */
export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheCreationTokens: a.cacheCreationTokens + b.cacheCreationTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
  };
}
