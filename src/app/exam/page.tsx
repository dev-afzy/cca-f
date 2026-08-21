export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { readinessFrom } from "@/lib/exam/score";
import { requireUserId } from "@/lib/current-user";
import StartExamButton from "./StartExamButton";

export default async function ExamStartPage() {
  const userId = await requireUserId();

  const last = await prisma.examAttempt.findFirst({
    where: { studentId: userId, status: { in: ["submitted", "expired"] } },
    orderBy: { submittedAt: "desc" },
  });
  const lastReadiness = last
    ? readinessFrom(last.correctCount, last.totalQuestions, last.perDomain)
    : null;

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center px-6">
      <div className="max-w-lg w-full space-y-6 text-center">
        <Link href="/" className="text-xs text-stone-400 hover:underline">← Home</Link>
        <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100">
          Mock Exam
        </h1>
        <ul className="text-sm text-stone-600 dark:text-stone-300 space-y-1">
          <li>60 questions · 120 minutes · timed</li>
          <li>One attempt runs at a time — no help, no pausing the clock</li>
          <li>Above real-exam difficulty; ready = ≥90% overall and no domain below 75%</li>
          <li>Independent of your tutoring progress — retake as often as you like</li>
        </ul>
        {lastReadiness && (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Last attempt: <strong>{lastReadiness.overallPct}%</strong>
            {lastReadiness.weakestDomain ? ` · weakest: ${lastReadiness.weakestDomain}` : ""}
          </p>
        )}
        <StartExamButton />
      </div>
    </main>
  );
}
