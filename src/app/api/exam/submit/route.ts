export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gradeAnswer, summarize, type GradedAnswer } from "@/lib/exam/score";

const STUDENT_ID = "default";

export async function POST(req: Request) {
  try {
    const { attemptId } = (await req.json()) as { attemptId?: number };
    if (typeof attemptId !== "number") {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const attempt = await prisma.examAttempt.findFirst({
      where: { id: attemptId, studentId: STUDENT_ID },
      include: { answers: { include: { question: true } } },
    });
    if (!attempt) return NextResponse.json({ error: "attempt not found" }, { status: 404 });
    if (attempt.status !== "in_progress") {
      return NextResponse.json({ ok: true }); // idempotent
    }

    const graded: GradedAnswer[] = [];
    for (const a of attempt.answers) {
      const correct = gradeAnswer(
        { correctKey: a.question.correctKey, distractorReasons: a.question.distractorReasons },
        a.chosenKey,
        a.permutation
      );
      graded.push({ domain: a.question.domain, correct });
      await prisma.examAnswer.update({ where: { id: a.id }, data: { correct } });
    }

    const { correctCount, perDomain } = summarize(graded);

    const elapsedSec =
      (Date.now() - attempt.startedAt.getTime()) / 1000;
    const status = elapsedSec > attempt.durationLimitSec ? "expired" : "submitted";

    await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        correctCount,
        perDomain: JSON.stringify(perDomain),
        submittedAt: new Date(),
        status,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/exam/submit]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
