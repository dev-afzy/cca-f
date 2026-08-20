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
    const { attemptId, questionId, chosenKey, chosenKeys } = (await req.json()) as {
      attemptId?: number;
      questionId?: number;
      chosenKey?: string;
      chosenKeys?: string[];
    };

    if (typeof attemptId !== "number" || typeof questionId !== "number") {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    // Multiple-response path: chosenKeys must be a non-empty array of up to
    // 4 distinct option keys. Single-answer path (chosenKey) is unchanged.
    let data: { chosenKey?: string; chosenKeys?: string };
    if (chosenKeys !== undefined) {
      const valid =
        Array.isArray(chosenKeys) &&
        chosenKeys.length > 0 &&
        chosenKeys.length <= 4 &&
        chosenKeys.every((k) => isOptionKey(k)) &&
        new Set(chosenKeys).size === chosenKeys.length;
      if (!valid) {
        return NextResponse.json({ error: "invalid body" }, { status: 400 });
      }
      data = { chosenKeys: JSON.stringify(chosenKeys) };
      if (chosenKeys.length === 1) {
        // Keep single-answer analytics/back-compat intact.
        data.chosenKey = chosenKeys[0];
      }
    } else {
      if (!isOptionKey(chosenKey)) {
        return NextResponse.json({ error: "invalid body" }, { status: 400 });
      }
      data = { chosenKey };
    }

    const attempt = await prisma.examAttempt.findFirst({
      where: { id: attemptId, studentId: userId },
      select: { status: true },
    });
    if (!attempt) return NextResponse.json({ error: "attempt not found" }, { status: 404 });
    if (attempt.status !== "in_progress") {
      return NextResponse.json({ error: "attempt already closed" }, { status: 409 });
    }

    const result = await prisma.examAnswer.updateMany({
      where: { attemptId, questionId },
      data,
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "question not in attempt" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/exam/answer]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
