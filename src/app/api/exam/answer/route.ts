export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isOptionKey } from "@/lib/tutor/shuffle";
import { requireUserIdApi } from "@/lib/current-user";

export async function POST(req: Request) {
  const userId = await requireUserIdApi();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { attemptId, questionId, chosenKey } = (await req.json()) as {
      attemptId?: number;
      questionId?: number;
      chosenKey?: string;
    };
    if (typeof attemptId !== "number" || typeof questionId !== "number" || !isOptionKey(chosenKey)) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const attempt = await prisma.examAttempt.findFirst({
      where: { id: attemptId, studentId: userId },
      select: { status: true },
    });
    if (!attempt) return NextResponse.json({ error: "attempt not found" }, { status: 404 });
    if (attempt.status !== "in_progress") {
      return NextResponse.json({ error: "attempt already closed" }, { status: 409 });
    }

    await prisma.examAnswer.updateMany({
      where: { attemptId, questionId },
      data: { chosenKey },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/exam/answer]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
