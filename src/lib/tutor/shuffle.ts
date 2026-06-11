import "server-only";

/**
 * Option-shuffling for MCQ presentation.
 *
 * The question bank stores options in a canonical order (A/B/C/D) with a fixed
 * correctKey. The seed bank is curated to keep correctKeys roughly uniform
 * across A/B/C/D, but authors still tend toward a B/C bias, and a static
 * canonical order would let a student learn answer positions across repeated
 * exposure to the same question.
 *
 * Shuffling at presentation time removes both risks without depending on the
 * bank staying balanced: each fetch picks a random permutation, presents the
 * options in the shuffled order, and persists the permutation so the
 * student's shuffled answer can be translated back to the canonical letter
 * for grading.
 *
 * A Permutation maps the SHUFFLED letter to the CANONICAL letter:
 *   { "A": "C", "B": "A", "C": "D", "D": "B" }
 * reads as: in the shuffled output the student sees, position A is the
 * canonical option C, position B is canonical A, etc.
 */

export type OptionKey = "A" | "B" | "C" | "D";
export const KEYS: readonly OptionKey[] = ["A", "B", "C", "D"];

export type CanonicalOptions = Record<OptionKey, string>;
export type Permutation = Record<OptionKey, OptionKey>;

type ShuffleResult = {
  shuffled: CanonicalOptions;
  permutation: Permutation;
};

/**
 * Returns options re-keyed into a random order and the permutation that maps
 * shuffled → canonical. Uses Fisher–Yates. If any of A/B/C/D is missing from
 * `canonical` (malformed bank entry), returns the input unchanged with an
 * identity permutation — never throws.
 */
export function shuffleOptions(canonical: CanonicalOptions): ShuffleResult {
  if (!KEYS.every((k) => typeof canonical[k] === "string")) {
    return {
      shuffled: { ...canonical },
      permutation: { A: "A", B: "B", C: "C", D: "D" },
    };
  }

  const canonicalKeys: OptionKey[] = [...KEYS];
  // Fisher–Yates
  for (let i = canonicalKeys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [canonicalKeys[i], canonicalKeys[j]] = [canonicalKeys[j], canonicalKeys[i]];
  }

  const shuffled = {} as CanonicalOptions;
  const permutation = {} as Permutation;
  KEYS.forEach((position, idx) => {
    const canonicalKey = canonicalKeys[idx];
    permutation[position] = canonicalKey;
    shuffled[position] = canonical[canonicalKey];
  });

  return { shuffled, permutation };
}

/**
 * Look up the canonical letter the student actually picked, given the shuffled
 * letter they saw on screen. Returns null if the shuffled key isn't valid
 * (e.g., model passed something other than A/B/C/D).
 */
export function translateToCanonical(
  shuffledKey: string,
  permutation: Permutation
): OptionKey | null {
  if (!isOptionKey(shuffledKey)) return null;
  const canonical = permutation[shuffledKey];
  return isOptionKey(canonical) ? canonical : null;
}

/**
 * Inverse of permutation: canonical letter → shuffled letter. Used when we
 * need to tell the model "the correct answer was X" using the same letter the
 * student saw on screen, not the bank's letter.
 */
export function invertPermutation(permutation: Permutation): Permutation {
  const inverse = {} as Permutation;
  for (const shuffled of KEYS) {
    const canonical = permutation[shuffled];
    if (isOptionKey(canonical)) {
      inverse[canonical] = shuffled;
    }
  }
  return inverse;
}

/**
 * Remap a "canonicalKey → reason" dict to a "shuffledKey → reason" dict so the
 * model can explain distractors using the letters the student saw.
 */
export function remapByPermutation<V>(
  canonicalDict: Record<string, V>,
  permutation: Permutation
): Record<string, V> {
  const inverse = invertPermutation(permutation);
  const out: Record<string, V> = {};
  for (const canonical of KEYS) {
    const shuffled = inverse[canonical];
    if (shuffled && canonicalDict[canonical] !== undefined) {
      out[shuffled] = canonicalDict[canonical];
    }
  }
  return out;
}

export function isOptionKey(s: unknown): s is OptionKey {
  return s === "A" || s === "B" || s === "C" || s === "D";
}

export function parsePermutation(json: string): Permutation | null {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const out = {} as Permutation;
    for (const k of KEYS) {
      const v = parsed[k];
      if (!isOptionKey(v)) return null;
      out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}
