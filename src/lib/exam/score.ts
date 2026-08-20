import { parsePermutation, translateToCanonical } from "@/lib/tutor/shuffle";

export const READY_OVERALL = 90;
export const READY_DOMAIN = 75;

export type GradedAnswer = { domain: string; correct: boolean };
export type PerDomain = Record<string, { correct: number; total: number }>;
export type Verdict = { ready: boolean; label: string };
export type Readiness = {
  overallPct: number;
  perDomain: PerDomain;
  weakestDomain: string | null;
  verdict: Verdict;
};

// Same normalization convention as grade(): strip whitespace, uppercase, take
// first char only (guards against "A." or "a)" style input).
function normalizeKey(key: string): string {
  return key.trim().toUpperCase().charAt(0);
}

/**
 * The set of canonical letters that count as correct for a question. Single-
 * answer questions (the common case) have exactly one: [correctKey].
 * Multiple-response questions carry an explicit correctKeys JSON array.
 * Falls back to [correctKey] when correctKeys is absent, empty, or malformed
 * so existing single-answer questions are unaffected. Sorted for stable set
 * comparison.
 */
export function correctKeySet(q: {
  correctKey: string;
  correctKeys?: string | null;
}): string[] {
  let keys: string[] = [q.correctKey];
  if (q.correctKeys) {
    try {
      const parsed = JSON.parse(q.correctKeys) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        keys = parsed.map((k) => String(k));
      }
    } catch {
      // malformed JSON — fall back to [correctKey]
    }
  }
  return keys.map(normalizeKey).sort();
}

/**
 * Grade a (possibly multiple-response) answer. chosenKeysShuffled are the
 * letters the student saw/clicked; each is translated back to canonical via
 * the stored permutation before comparing. Requires an exact set match
 * against correctKeySet(question) — no partial credit. null/empty is wrong.
 * Duplicate chosen keys are de-duplicated before comparison so they can't
 * manufacture a false match against a larger correct set.
 */
export function gradeAnswerSet(
  question: { correctKey: string; correctKeys?: string | null },
  chosenKeysShuffled: string[] | null,
  permutationJson: string
): boolean {
  if (!chosenKeysShuffled || chosenKeysShuffled.length === 0) return false;
  const perm = parsePermutation(permutationJson);
  const canonicalChosen = chosenKeysShuffled.map((k) =>
    perm ? translateToCanonical(k, perm) ?? k : k
  );
  const normalizedChosen = [...new Set(canonicalChosen.map(normalizeKey))].sort();
  const expected = correctKeySet(question);
  if (normalizedChosen.length !== expected.length) return false;
  return normalizedChosen.every((k, i) => k === expected[i]);
}

/**
 * Grade one single-answer answer. chosenKeyShuffled is the letter the student
 * saw/clicked; translate it back to canonical via the stored permutation
 * before grading. null (unanswered) is wrong. Thin wrapper over
 * gradeAnswerSet so existing single-answer callers are unaffected.
 */
export function gradeAnswer(
  question: { correctKey: string; correctKeys?: string | null; distractorReasons: string },
  chosenKeyShuffled: string | null,
  permutationJson: string
): boolean {
  return gradeAnswerSet(
    question,
    chosenKeyShuffled ? [chosenKeyShuffled] : null,
    permutationJson
  );
}

export function summarize(graded: GradedAnswer[]): {
  correctCount: number;
  total: number;
  overallPct: number;
  perDomain: PerDomain;
} {
  const perDomain: PerDomain = {};
  let correctCount = 0;
  for (const g of graded) {
    const d = (perDomain[g.domain] ??= { correct: 0, total: 0 });
    d.total += 1;
    if (g.correct) {
      d.correct += 1;
      correctCount += 1;
    }
  }
  const total = graded.length;
  const overallPct = total === 0 ? 0 : Math.round((correctCount / total) * 100);
  return { correctCount, total, overallPct, perDomain };
}

export function verdict(overallPct: number, perDomain: PerDomain): Verdict {
  const domainsOk = Object.values(perDomain).every(
    (d) => d.total === 0 || (d.correct / d.total) * 100 >= READY_DOMAIN
  );
  const ready = overallPct >= READY_OVERALL && domainsOk;
  return {
    ready,
    label: ready
      ? "Ready to sit the real exam"
      : "Keep training — not ready yet",
  };
}

export function readinessFrom(
  correctCount: number,
  total: number,
  perDomainJson: string
): Readiness {
  const overallPct = total === 0 ? 0 : Math.round((correctCount / total) * 100);
  let perDomain: PerDomain = {};
  try {
    perDomain = JSON.parse(perDomainJson) as PerDomain;
  } catch {
    perDomain = {};
  }
  let weakestDomain: string | null = null;
  let weakestPct = Infinity;
  for (const [d, v] of Object.entries(perDomain)) {
    if (v.total === 0) continue;
    const pct = (v.correct / v.total) * 100;
    if (pct < weakestPct) {
      weakestPct = pct;
      weakestDomain = d;
    }
  }
  return { overallPct, perDomain, weakestDomain, verdict: verdict(overallPct, perDomain) };
}
