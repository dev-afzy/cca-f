export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { selectExamQuestions, type SourceQuestion } from "@/lib/exam/select";
import { requireUserIdApi } from "@/lib/current-user";

export async function POST() {
  const userId = await requireUserIdApi();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const pool = (await prisma.question.findMany({
      where: { difficulty: "hard" },
      select: { id: true, domain: true, stem: true, options: true },
    })) as SourceQuestion[];

    const selected = selectExamQuestions(pool);

    const attempt = await prisma.examAttempt.create({
      data: {
        studentId: userId,
        status: "in_progress",
        totalQuestions: selected.length,
        durationLimitSec: 7200,
        answers: {
          create: selected.map((s) => ({
            questionId: s.questionId,
            orderIndex: s.orderIndex,
            permutation: JSON.stringify(s.permutation),
          })),
        },
      },
    });

    return NextResponse.json({ attemptId: attempt.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/exam/start]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
