export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readinessFrom } from "@/lib/exam/score";
import {
  parsePermutation,
  invertPermutation,
  remapByPermutation,
  KEYS,
  type CanonicalOptions,
} from "@/lib/tutor/shuffle";
import { DOMAIN_LABELS } from "@/lib/domains";

const STUDENT_ID = "default";

export default async function ExamResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId: attemptIdStr } = await params;
  const attemptId = Number(attemptIdStr);
  if (!Number.isFinite(attemptId)) redirect("/exam");

  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, studentId: STUDENT_ID },
    include: {
      answers: {
        orderBy: { orderIndex: "asc" },
        include: { question: true },
      },
    },
  });
  if (!attempt) redirect("/exam");
  if (attempt.status === "in_progress") redirect(`/exam/${attemptId}`);

  const readiness = readinessFrom(attempt.correctCount, attempt.totalQuestions, attempt.perDomain);

  const review = attempt.answers.map((a) => {
    const canonical = JSON.parse(a.question.options) as CanonicalOptions;
    const perm = parsePermutation(a.permutation);
    const shuffledOptions = {} as Record<"A" | "B" | "C" | "D", string>;
    for (const pos of KEYS) shuffledOptions[pos] = canonical[perm ? perm[pos] : pos];

    const correctShuffledKey = perm
      ? invertPermutation(perm)[a.question.correctKey as "A" | "B" | "C" | "D"]
      : (a.question.correctKey as "A" | "B" | "C" | "D");
    const reasons = (() => {
      try {
        const canonicalReasons = JSON.parse(a.question.distractorReasons) as Record<string, string>;
        return perm ? remapByPermutation(canonicalReasons, perm) : canonicalReasons;
      } catch {
        return {} as Record<string, string>;
      }
    })();

    return {
      orderIndex: a.orderIndex,
      stem: a.question.stem,
      domain: a.question.domain,
      options: shuffledOptions,
      chosen: a.chosenKey,
      correct: a.correct,
      correctKey: correctShuffledKey,
      reasons,
    };
  });

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xs text-stone-400 hover:underline">← Home</Link>
          <Link href="/exam" className="text-xs text-stone-400 hover:underline">Retake →</Link>
        </div>

        <section className="text-center space-y-2">
          <p className="text-xs uppercase tracking-widest text-stone-400">Result</p>
          <h1 className="text-5xl font-bold">
            {readiness.overallPct}%
          </h1>
          <p className={`text-sm font-medium ${readiness.verdict.ready ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
            {readiness.verdict.label}
          </p>
          <p className="text-xs text-stone-400">
            {attempt.correctCount}/{attempt.totalQuestions} correct · real exam passes at 720/1000
            {attempt.status === "expired" ? " · time expired" : ""}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">By domain</h2>
          {Object.entries(readiness.perDomain).map(([domain, d]) => {
            const pct = d.total ? Math.round((d.correct / d.total) * 100) : 0;
            const weak = pct < 75;
            return (
              <div key={domain} className="flex items-center gap-3 text-sm">
                <span className="w-56 shrink-0 text-stone-600 dark:text-stone-300">
                  {DOMAIN_LABELS[domain] ?? domain}
                </span>
                <div className="flex-1 h-2 rounded bg-stone-200 dark:bg-stone-800 overflow-hidden">
                  <div className={`h-full ${weak ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 text-right tabular-nums">{d.correct}/{d.total}</span>
              </div>
            );
          })}
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold">Review</h2>
          {review.map((r) => (
            <div key={r.orderIndex} className="border border-stone-200 dark:border-stone-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-400">Q{r.orderIndex + 1} · {DOMAIN_LABELS[r.domain] ?? r.domain}</span>
                <span className={r.correct ? "text-emerald-600" : "text-red-600"}>
                  {r.correct ? "✓ Correct" : `✗ Your answer: ${r.chosen ?? "—"} · Correct: ${r.correctKey}`}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{r.stem}</p>
              <ul className="space-y-1 text-sm">
                {KEYS.map((k) => {
                  const isCorrect = k === r.correctKey;
                  const isChosen = k === r.chosen;
                  return (
                    <li key={k} className={`px-3 py-2 rounded ${isCorrect ? "bg-emerald-50 dark:bg-emerald-950/40" : isChosen ? "bg-red-50 dark:bg-red-950/40" : ""}`}>
                      <span className="font-semibold mr-2">{k}</span>{r.options[k]}
                      {r.reasons[k] ? <p className="mt-1 text-xs text-stone-500">{r.reasons[k]}</p> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
