/**
 * Regression checks for exam grading.
 *
 *   npm run test:grading
 *
 * Why this file exists: `gradeAnswerSet` is the single point where a student's
 * answer becomes a right-or-wrong verdict on a certification mock. A silent bug
 * here — translating only the first key, permuting the answer key instead of the
 * response, treating a subset as a match — marks correct answers wrong (or worse,
 * wrong answers right) with no visible failure. The repo has no test runner, so
 * this follows the same convention as `scripts/validate-content.ts`: a plain tsx
 * assertion script wired to an npm script, non-zero exit on failure.
 *
 * Vocabulary, because it is the easiest thing to get backwards:
 *   - CANONICAL keys are how options are stored in the DB (`correctKey`,
 *     `correctKeys`).
 *   - SHUFFLED keys are the positions the student actually saw and clicked.
 *   - The stored permutation maps shuffled position -> canonical option, so only
 *     the student's CHOSEN keys are ever translated. Answer keys are never
 *     permuted.
 */
import { correctKeySet, gradeAnswerSet, gradeAnswer } from "../src/lib/exam/score";

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.error(`  FAIL  ${label}\n          expected ${e}, got ${a}`);
  } else {
    console.log(`  ok    ${label}`);
  }
}

// Identity permutation: the student saw options in canonical order.
const IDENT = JSON.stringify({ A: "A", B: "B", C: "C", D: "D" });
// Shuffled: student position A showed canonical C, B->A, C->D, D->B.
const SHUF = JSON.stringify({ A: "C", B: "A", C: "D", D: "B" });

const single = { correctKey: "C", correctKeys: null };
const pair = { correctKey: "C", correctKeys: JSON.stringify(["C", "B"]) };
const triple = { correctKey: "A", correctKeys: JSON.stringify(["A", "C", "D"]) };

console.log("correctKeySet");
check("single-answer falls back to [correctKey]", correctKeySet(single), ["C"]);
check("multi returns sorted canonical keys", correctKeySet(pair), ["B", "C"]);
check("triple returns all three sorted", correctKeySet(triple), ["A", "C", "D"]);
// The answer key must never be run through the permutation.
check("is permutation-independent", correctKeySet(pair), ["B", "C"]);

console.log("\nsingle-answer (back-compat: the 1-element case)");
check("correct via identity perm", gradeAnswer({ ...single, distractorReasons: "{}" }, "C", IDENT), true);
check("wrong via identity perm", gradeAnswer({ ...single, distractorReasons: "{}" }, "A", IDENT), false);
// Student clicked position A, which showed canonical C -> correct.
check("correct through a shuffle", gradeAnswer({ ...single, distractorReasons: "{}" }, "A", SHUF), true);
check("wrong through a shuffle", gradeAnswer({ ...single, distractorReasons: "{}" }, "B", SHUF), false);
check("unanswered is wrong", gradeAnswer({ ...single, distractorReasons: "{}" }, null, IDENT), false);

console.log("\nmultiple-response: exact-set match");
check("exact pair matches", gradeAnswerSet(pair, ["B", "C"], IDENT), true);
check("order does not matter", gradeAnswerSet(pair, ["C", "B"], IDENT), true);
check("subset (1 of 2) is wrong", gradeAnswerSet(pair, ["C"], IDENT), false);
check("superset (3 when 2) is wrong", gradeAnswerSet(pair, ["B", "C", "A"], IDENT), false);
check("disjoint pair is wrong", gradeAnswerSet(pair, ["A", "D"], IDENT), false);
check("one right one wrong is wrong", gradeAnswerSet(pair, ["C", "A"], IDENT), false);
check("exact triple matches", gradeAnswerSet(triple, ["D", "A", "C"], IDENT), true);
check("triple missing one is wrong", gradeAnswerSet(triple, ["A", "C"], IDENT), false);
check("null is wrong", gradeAnswerSet(pair, null, IDENT), false);
check("empty array is wrong", gradeAnswerSet(pair, [], IDENT), false);

console.log("\nmultiple-response: every key translated (not just the first)");
// Shuffled A->C and D->B, so ["A","D"] is canonical ["C","B"] == the pair.
check("both keys translated through shuffle", gradeAnswerSet(pair, ["A", "D"], SHUF), true);
// If only the first were translated, ["A","B"] would wrongly become ["C","B"].
check("untranslated second key does not sneak through", gradeAnswerSet(pair, ["A", "B"], SHUF), false);

console.log("\nmultiple-response: duplicates cannot fake a match");
// ["B","B"] -> canonical ["A","A"] -> dedupes to length 1 != 2 expected.
check("duplicate shuffled keys are wrong", gradeAnswerSet(pair, ["B", "B"], SHUF), false);
check("duplicate canonical keys are wrong", gradeAnswerSet(pair, ["C", "C"], IDENT), false);

console.log("\nrobustness");
// A single correct key can never satisfy a 2-key set — this is what stops the
// tutor's record_attempt (single chosenKey) from ever marking a multi-response
// question correct.
check("one key never satisfies a pair", gradeAnswerSet(pair, ["C"], IDENT), false);
check("lowercase input is normalized", gradeAnswerSet(pair, ["c", "b"], IDENT), true);
check("unparseable permutation falls back to raw keys", gradeAnswerSet(pair, ["B", "C"], "not-json"), true);
check("empty correctKeys array falls back to correctKey", correctKeySet({ correctKey: "C", correctKeys: "[]" }), ["C"]);

console.log(
  failures === 0
    ? `\nGrading checks passed: ${checks}/${checks}.`
    : `\nGrading checks FAILED: ${failures} of ${checks}.`
);
process.exit(failures === 0 ? 0 : 1);
