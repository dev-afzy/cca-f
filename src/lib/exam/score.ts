import { grade } from "@/lib/tutor/grade";
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

/**
 * Grade one answer. chosenKeyShuffled is the letter the student saw/clicked;
 * translate it back to canonical via the stored permutation before grading.
 * null (unanswered) is wrong.
 */
export function gradeAnswer(
  question: { correctKey: string; distractorReasons: string },
  chosenKeyShuffled: string | null,
  permutationJson: string
): boolean {
  if (!chosenKeyShuffled) return false;
  const perm = parsePermutation(permutationJson);
  const canonicalChosen = perm
    ? translateToCanonical(chosenKeyShuffled, perm) ?? chosenKeyShuffled
    : chosenKeyShuffled;
  return grade(question, canonicalChosen).correct;
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
