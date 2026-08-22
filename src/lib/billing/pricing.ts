/**
 * Pricing table and cost calculation in micro-dollars (µ$).
 * Pure math module — no server-only imports, fully testable.
 */

import { ModelUsage } from "./usage";

/**
 * Prices in µ$ per 1M tokens.
 * Keys are exact model identifiers.
 */
export const PRICES: Record<
  string,
  { in: number; out: number; cacheWrite: number; cacheRead: number }
> = {
  "claude-sonnet-4-6": {
    in: 3_000_000,
    out: 15_000_000,
    cacheWrite: 3_750_000,
    cacheRead: 300_000,
  },
  "claude-haiku-4-5": {
    in: 1_000_000,
    out: 5_000_000,
    cacheWrite: 1_250_000,
    cacheRead: 100_000,
  },
  "claude-haiku-4-5-20251001": {
    in: 1_000_000,
    out: 5_000_000,
    cacheWrite: 1_250_000,
    cacheRead: 100_000,
  },
  // $1.40 / $4.40 per 1M tokens (in/out) — https://venturebeat.com/technology/glm-5-3-hits-the-api-at-1-4-4-4-per-million-tokens
  // Sourced from that public pricing announcement, not verified against
  // Z.ai's live Anthropic-compatible endpoint — no GLM_API_KEY credential has
  // been available in any environment this feature was built in. Cache rates
  // in particular are unconfirmed; defaulting cacheWrite/cacheRead to the
  // base input rate is deliberately conservative: if GLM turns out not to
  // discount cached tokens, this doesn't overbill; if it does and this table
  // is wrong, it undercounts the discount rather than manufacturing one that
  // was never measured. A real smoke test against api.z.ai
  // (docs/superpowers/plans/2026-08-22-glm-provider-support.md, Task 1) is
  // still pending — correct this table if Z.ai's actual API differs. See
  // docs/BACKLOG.md for the tracked follow-up.
  "glm-5.3": {
    in: 1_400_000,
    out: 4_400_000,
    cacheWrite: 1_400_000,
    cacheRead: 1_400_000,
  },
};

/**
 * Markup multiplier from environment or default 1.6x.
 */
export const MARKUP = Number(process.env.CCAF_MARKUP ?? 1.6);

/**
 * Calculate raw cost in micro-dollars for a single model's usage.
 * Throws if model is not found in PRICES table.
 */
export function rawCostMicros(u: ModelUsage): number {
  const price = PRICES[u.model];
  if (!price) {
    throw new Error(
      `Unknown model for billing: "${u.model}" — not in PRICES table`
    );
  }

  return (
    (u.inputTokens * price.in +
      u.outputTokens * price.out +
      u.cacheCreationTokens * price.cacheWrite +
      u.cacheReadTokens * price.cacheRead) /
    1_000_000
  );
}

/**
 * Calculate final billed amount from per-model usages.
 * Returns raw (pre-markup) and billed (post-markup) costs in micro-dollars.
 * Both are ceiling'd to the nearest micro-dollar.
 */
export function billedMicros(
  perModel: ModelUsage[]
): { rawMicros: number; billedMicros: number } {
  const rawMicros = Math.ceil(
    perModel.reduce((sum, usage) => sum + rawCostMicros(usage), 0)
  );
  const billedMicros = Math.ceil(rawMicros * MARKUP);

  return { rawMicros, billedMicros };
}
