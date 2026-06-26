import "server-only";
import {
  shuffleOptions,
  type CanonicalOptions,
  type Permutation,
} from "@/lib/tutor/shuffle";

export const EXAM_DOMAIN_WEIGHTS: Record<string, number> = {
  Agentic: 16,
  "Claude Code": 12,
  Prompts: 12,
  "Tool & MCP": 11,
  Context: 9,
};
export const EXAM_TOTAL = 60;

export type SourceQuestion = {
  id: number;
  domain: string;
  stem: string;
  options: string; // JSON string {A,B,C,D}
};

export type SelectedQuestion = {
  questionId: number;
  orderIndex: number;
  stem: string;
  shuffled: CanonicalOptions;
  permutation: Permutation;
};

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Pick EXAM_TOTAL questions to the domain weights from a pool of hard
 * questions, shuffle the overall order, and shuffle each question's options
 * (persisting the permutation). Re-shuffled on every call → replayable.
 * Throws if a domain can't meet its weight (the validator guarantees ≥60).
 */
export function selectExamQuestions(pool: SourceQuestion[]): SelectedQuestion[] {
  const byDomain = new Map<string, SourceQuestion[]>();
  for (const q of pool) {
    const list = byDomain.get(q.domain) ?? [];
    list.push(q);
    byDomain.set(q.domain, list);
  }

  const picked: SourceQuestion[] = [];
  for (const [domain, need] of Object.entries(EXAM_DOMAIN_WEIGHTS)) {
    const available = byDomain.get(domain) ?? [];
    if (available.length < need) {
      throw new Error(
        `Exam selection: domain "${domain}" needs ${need} hard questions, has ${available.length}`
      );
    }
    picked.push(...shuffleInPlace([...available]).slice(0, need));
  }

  shuffleInPlace(picked);

  return picked.map((q, idx) => {
    const canonical = JSON.parse(q.options) as CanonicalOptions;
    const { shuffled, permutation } = shuffleOptions(canonical);
    return {
      questionId: q.id,
      orderIndex: idx,
      stem: q.stem,
      shuffled,
      permutation,
    };
  });
}
