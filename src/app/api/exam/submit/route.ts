export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gradeAnswerSet, summarize, type GradedAnswer } from "@/lib/exam/score";
import { requireUserIdApi } from "@/lib/current-user";

// The student's chosen letters (shuffled-position) for one answer row.
// Prefers the chosenKeys JSON array (multi-response); falls back to the
// single chosenKey for single-answer rows or legacy data.
function parseChosenKeys(a: { chosenKey: string | null; chosenKeys: string | null }): string[] | null {
  if (a.chosenKeys) {
    try {
      const parsed = JSON.parse(a.chosenKeys) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((k) => String(k));
      }
    } catch {
      // malformed JSON — fall back to chosenKey below
    }
  }
  return a.chosenKey ? [a.chosenKey] : null;
}

export async function POST(req: Request) {
  const userId = await requireUserIdApi();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { attemptId } = (await req.json()) as { attemptId?: number };
    if (typeof attemptId !== "number") {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const attempt = await prisma.examAttempt.findFirst({
      where: { id: attemptId, studentId: userId },
      include: { answers: { include: { question: true } } },
    });
    if (!attempt) return NextResponse.json({ error: "attempt not found" }, { status: 404 });
    if (attempt.status !== "in_progress") {
      return NextResponse.json({ ok: true }); // idempotent
    }

    const graded: GradedAnswer[] = [];
    for (const a of attempt.answers) {
      const chosenKeys = parseChosenKeys(a);
      const correct = gradeAnswerSet(
        { correctKey: a.question.correctKey, correctKeys: a.question.correctKeys },
        chosenKeys,
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
