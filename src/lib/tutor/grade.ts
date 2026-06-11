type Question = {
  correctKey: string;
  distractorReasons: string;
};

type GradeResult = {
  correct: boolean;
  correctKey: string;
  distractorReasons: Record<string, string>;
};

export function grade(question: Question, chosenKey: string): GradeResult {
  // Normalize: strip whitespace, uppercase, take first char only (guards against "A." or "a)")
  const normalizedChosen = chosenKey.trim().toUpperCase().charAt(0);
  const validKeys = ["A", "B", "C", "D"];
  if (!validKeys.includes(normalizedChosen)) {
    return {
      correct: false,
      correctKey: question.correctKey,
      distractorReasons: {},
    };
  }
  const correct = normalizedChosen === question.correctKey.trim().toUpperCase().charAt(0);
  let distractorReasons: Record<string, string> = {};
  try {
    distractorReasons = JSON.parse(question.distractorReasons) as Record<string, string>;
  } catch {
    // ignore parse errors
  }
  return {
    correct,
    correctKey: question.correctKey,
    distractorReasons,
  };
}
