"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export type RunnerQuestion = {
  orderIndex: number;
  questionId: number;
  stem: string;
  options: Record<"A" | "B" | "C" | "D", string>;
  chosen: string | null;
};

const KEYS = ["A", "B", "C", "D"] as const;

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ExamRunner({
  attemptId,
  remainingSec,
  questions,
}: {
  attemptId: number;
  remainingSec: number;
  questions: RunnerQuestion[];
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const q of questions) if (q.chosen) init[q.questionId] = q.chosen;
    return init;
  });
  const [remaining, setRemaining] = useState(remainingSec);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await fetch("/api/exam/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId }),
      });
    } finally {
      router.push(`/exam/${attemptId}/result`);
    }
  }, [attemptId, router]);

  // Countdown; auto-submit at zero.
  useEffect(() => {
    if (remaining <= 0) {
      void submit();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, submit]);

  const choose = (questionId: number, key: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: key }));
    void fetch("/api/exam/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, questionId, chosenKey: key }),
    });
  };

  const q = questions[idx];
  const answeredCount = Object.keys(answers).length;

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <header className="border-b border-stone-200 dark:border-stone-800 px-6 py-3 flex items-center justify-between sticky top-0 bg-white/90 dark:bg-stone-900/90 backdrop-blur">
        <span className="text-sm font-semibold">Mock Exam</span>
        <span className="text-sm tabular-nums">
          {answeredCount}/{questions.length} answered · ⏱ {fmt(remaining)}
        </span>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        <p className="text-xs text-stone-400">Question {idx + 1} of {questions.length}</p>
        <p className="text-base leading-relaxed whitespace-pre-wrap">{q.stem}</p>

        <div className="space-y-2">
          {KEYS.map((k) => {
            const selected = answers[q.questionId] === k;
            return (
              <button
                key={k}
                onClick={() => choose(q.questionId, k)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  selected
                    ? "border-stone-900 dark:border-stone-100 bg-stone-100 dark:bg-stone-800"
                    : "border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                }`}
              >
                <span className="font-semibold mr-2">{k}</span>
                {q.options[k]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="px-4 py-2 text-sm rounded border border-stone-300 dark:border-stone-700 disabled:opacity-40"
          >
            ← Prev
          </button>
          {idx < questions.length - 1 ? (
            <button
              onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}
              className="px-4 py-2 text-sm rounded bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={() => void submit()}
              disabled={submitting}
              className="px-5 py-2 text-sm rounded bg-emerald-700 text-white disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit exam"}
            </button>
          )}
        </div>

        {/* Question navigator */}
        <div className="grid grid-cols-10 gap-1.5 pt-4">
          {questions.map((qq, i) => {
            const isAnswered = answers[qq.questionId] !== undefined;
            const isCurrent = i === idx;
            return (
              <button
                key={qq.questionId}
                onClick={() => setIdx(i)}
                className={`h-8 text-xs rounded ${
                  isCurrent
                    ? "ring-2 ring-stone-900 dark:ring-stone-100 "
                    : ""
                }${
                  isAnswered
                    ? "bg-stone-300 dark:bg-stone-600"
                    : "bg-stone-100 dark:bg-stone-800 text-stone-400"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => void submit()}
          disabled={submitting}
          className="w-full mt-2 px-5 py-3 text-sm rounded-lg bg-emerald-700 text-white disabled:opacity-60"
        >
          {submitting ? "Submitting…" : `Submit exam (${answeredCount}/${questions.length} answered)`}
        </button>
      </div>
    </main>
  );
}
