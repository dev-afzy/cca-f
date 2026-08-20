export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parsePermutation, KEYS, type CanonicalOptions } from "@/lib/tutor/shuffle";
import { requireUserId } from "@/lib/current-user";
import ExamRunner, { type RunnerQuestion } from "./ExamRunner";

export default async function ExamRunnerPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const userId = await requireUserId();

  const { attemptId: attemptIdStr } = await params;
  const attemptId = Number(attemptIdStr);
  if (!Number.isFinite(attemptId)) redirect("/exam");

  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, studentId: userId },
    include: {
      answers: {
        orderBy: { orderIndex: "asc" },
        include: { question: { select: { stem: true, options: true, responseCount: true } } },
      },
    },
  });
  if (!attempt) redirect("/exam");
  if (attempt.status !== "in_progress") redirect(`/exam/${attemptId}/result`);

  const questions: RunnerQuestion[] = attempt.answers.map((a) => {
    const canonical = JSON.parse(a.question.options) as CanonicalOptions;
    const perm = parsePermutation(a.permutation);
    // Rebuild what the student saw: shuffledPosition -> canonical[perm[position]]
    const options = {} as Record<"A" | "B" | "C" | "D", string>;
    for (const pos of KEYS) {
      const canonicalKey = perm ? perm[pos] : pos;
      options[pos] = canonical[canonicalKey];
    }
    // chosenKeys holds the student's shuffled-position picks for
    // multiple-response questions (null for single-answer / unanswered).
    let chosenKeys: string[] | null = null;
    if (a.chosenKeys) {
      try {
        const parsed = JSON.parse(a.chosenKeys) as unknown;
        if (Array.isArray(parsed)) chosenKeys = parsed.map((k) => String(k));
      } catch {
        chosenKeys = null;
      }
    }
    return {
      orderIndex: a.orderIndex,
      questionId: a.questionId,
      stem: a.question.stem,
      options,
      chosen: a.chosenKey,
      responseCount: a.question.responseCount,
      chosenKeys,
    };
  });

  const elapsedSec = (Date.now() - attempt.startedAt.getTime()) / 1000;
  const remainingSec = Math.max(0, Math.round(attempt.durationLimitSec - elapsedSec));

  return <ExamRunner attemptId={attemptId} remainingSec={remainingSec} questions={questions} />;
}
