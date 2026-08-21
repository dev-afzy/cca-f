export const dynamic = "force-dynamic";

import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import NewSessionButton from "./NewSessionButton";
import StartNewSprintButton from "./StartNewSprintButton";
import SignOutButton from "./SignOutButton";
import { prisma } from "@/lib/prisma";
import { getMasterySnapshot } from "@/lib/tutor/mastery";
import { readinessFrom } from "@/lib/exam/score";
import { HOUR_TOPICS } from "@/lib/hour-topics";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-10">
            <p className="text-[10px] tracking-[0.3em] uppercase text-stone-400 dark:text-stone-500 font-medium">
              Claude Certified Architect — Foundations
            </p>
            <ThemeToggle />
          </div>
          <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
            <p className="text-[10px] tracking-[0.3em] uppercase text-amber-600 dark:text-amber-500 font-semibold">
              Study scaffold
            </p>
            <h1 className="text-[2.75rem] leading-none font-bold tracking-tight text-stone-900 dark:text-stone-50">
              CCA-F Tutor
            </h1>
            <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed max-w-xs">
              Architect-level fluency in 24 hours — adaptive questions, spaced recall, timed mocks.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-400 dark:bg-amber-500 dark:hover:bg-amber-400 text-white px-8 py-4 font-semibold shadow-md hover:shadow-lg transition-all duration-150"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const userId = session.user.id;

  const student = await prisma.student.findUnique({ where: { id: userId } });
  const snapshot = student ? await getMasterySnapshot(userId) : null;

  const attempts = await prisma.examAttempt.findMany({
    where: { studentId: userId, status: { in: ["submitted", "expired"] } },
    orderBy: { submittedAt: "desc" },
    take: 5,
  });
  const last = attempts[0] ?? null;
  const readiness = last ? readinessFrom(last.correctCount, last.totalQuestions, last.perDomain) : null;
  const trend = [...attempts]
    .reverse()
    .map((a) => readinessFrom(a.correctCount, a.totalQuestions, a.perDomain).overallPct);

  const currentHour = snapshot?.currentHour ?? 0;
  const nextHour = Math.min(currentHour + 1, 24);
  const nextTopic = HOUR_TOPICS[nextHour] ?? "—";
  const daysRemaining = snapshot?.daysRemaining ?? null;

  const ringPct = readiness?.overallPct ?? 0;
  const circumference = 2 * Math.PI * 34;
  const dashOffset = circumference * (1 - ringPct / 100);

  // Gauge accent: green when ready, amber when still climbing
  const gaugeColor = readiness?.verdict.ready ? "text-emerald-500" : "text-amber-500";
  const verdictLabel = readiness?.verdict.ready ? "Ready" : "Almost ready";
  const verdictColor = readiness?.verdict.ready
    ? "text-emerald-500 dark:text-emerald-400"
    : "text-amber-600 dark:text-amber-400";

  // Sparkline: compute bar heights clamped to container
  const sparkMax = trend.length > 0 ? Math.max(...trend, 1) : 100;

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-10">
          <p className="text-[10px] tracking-[0.3em] uppercase text-stone-400 dark:text-stone-500 font-medium">
            Claude Certified Architect — Foundations
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-500 dark:text-stone-400">
              {session.user.name ?? "Student"}
            </span>
            <SignOutButton />
            <ThemeToggle />
          </div>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 auto-rows-[minmax(148px,auto)]">

          {/* ── Hero / exam CTA ────────────────────────────────────── */}
          <section className="md:col-span-2 md:row-span-2 rounded-2xl border border-stone-200 dark:border-stone-800 bg-gradient-to-br from-amber-50 via-stone-50 to-stone-100 dark:from-amber-950/30 dark:via-stone-950 dark:to-stone-900 shadow-sm p-8 flex flex-col justify-between">
            <div>
              <p className="text-[10px] tracking-[0.3em] uppercase text-amber-600 dark:text-amber-500 font-semibold mb-3">
                Study scaffold
              </p>
              <h1
                className="text-[2.75rem] leading-none font-bold tracking-tight text-stone-900 dark:text-stone-50"
              >
                CCA-F Tutor
              </h1>
              <p className="mt-3 text-stone-500 dark:text-stone-400 text-sm leading-relaxed max-w-xs">
                Architect-level fluency in 24 hours — adaptive questions, spaced recall, timed mocks.
              </p>
            </div>
            <Link
              href="/exam"
              className="mt-7 inline-flex flex-col items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-400 dark:bg-amber-500 dark:hover:bg-amber-400 text-white py-4 font-semibold shadow-md hover:shadow-lg transition-all duration-150"
            >
              Take mock exam
              <span className="text-xs font-normal opacity-80 mt-0.5 tracking-wide">
                60 questions · 120 min · timed
              </span>
            </Link>
          </section>

          {/* ── Readiness gauge ────────────────────────────────────── */}
          <section className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm p-5 flex flex-col items-center justify-center text-center gap-1">
            <p className="text-[10px] tracking-[0.3em] uppercase text-stone-400 dark:text-stone-500 font-semibold mb-1">
              Readiness
            </p>
            {readiness ? (
              <>
                <div className="relative w-[96px] h-[96px]">
                  <svg viewBox="0 0 80 80" className="w-[96px] h-[96px] -rotate-90">
                    <circle
                      cx="40" cy="40" r="34"
                      fill="none"
                      stroke="currentColor"
                      className="text-stone-100 dark:text-stone-800"
                      strokeWidth="6"
                    />
                    <circle
                      cx="40" cy="40" r="34"
                      fill="none"
                      stroke="currentColor"
                      className={gaugeColor}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                    />
                  </svg>
                  <div
                    className="absolute inset-0 flex items-center justify-center text-[1.1rem] font-bold text-stone-800 dark:text-stone-100"
                  >
                    {readiness.overallPct}%
                  </div>
                </div>
                <p className={`text-xs font-semibold mt-1 ${verdictColor}`}>
                  {verdictLabel}
                </p>
              </>
            ) : (
              <Link
                href="/exam"
                className="text-sm text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 hover:underline transition-colors"
              >
                Take your first mock →
              </Link>
            )}
          </section>

          {/* ── Continue tutoring / Sprint complete ────────────────── */}
          <section className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm p-5 flex flex-col gap-1">
            <span className="font-semibold text-sm text-stone-800 dark:text-stone-100">
              {currentHour >= 24 ? "Sprint complete 🎉" : "Continue tutoring"}
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400 leading-snug">
              {currentHour >= 24
                ? "All 24 hours done — start a fresh review session or take a mock exam."
                : `Resume Hour ${nextHour} — ${nextTopic}`}
            </span>
            <div className="mt-auto flex items-center gap-2 pt-2">
              <Link
                href="/chat"
                className="text-[11px] px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 font-medium transition-colors"
              >
                {currentHour >= 24 ? "Open chat" : "Resume"}
              </Link>
              <NewSessionButton
                label="New session"
                className="text-[11px] px-2.5 py-1 rounded-full border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 font-medium transition-colors disabled:opacity-50"
              />
              {currentHour >= 24 && (
                <StartNewSprintButton
                  className="text-[11px] px-2.5 py-1 rounded-full border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 font-medium transition-colors disabled:opacity-50"
                />
              )}
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 font-medium">
                Hour {currentHour} / 24
              </span>
            </div>
          </section>

          {/* ── Exam trend sparkline ───────────────────────────────── */}
          <section className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm p-5">
            <p className="text-[10px] tracking-[0.3em] uppercase text-stone-400 dark:text-stone-500 font-semibold mb-3">
              Exam trend
            </p>
            {trend.length >= 2 ? (
              <>
                <p
                  className="text-base font-medium text-stone-700 dark:text-stone-300 tabular-nums mb-3"
                >
                  {trend.join(" → ")}
                </p>
                <div className="flex items-end gap-1.5 h-10">
                  {trend.map((p, i) => {
                    const heightPct = Math.max(12, Math.round((p / sparkMax) * 100));
                    const isLast = i === trend.length - 1;
                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-sm transition-all ${isLast ? "opacity-100" : "opacity-60"}`}
                        style={{
                          height: `${heightPct}%`,
                          background: isLast
                            ? "linear-gradient(to top, #d97706, #f59e0b)"
                            : "linear-gradient(to top, #92400e, #d97706)",
                        }}
                      />
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                Take two mocks to see your trend.
              </p>
            )}
          </section>

          {/* ── Progress & history ─────────────────────────────────── */}
          <Link
            href="/ledger"
            className="group md:col-span-2 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm hover:shadow-md hover:border-stone-300 dark:hover:border-stone-700 p-5 flex items-center gap-4 transition-all duration-150"
          >
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-sm text-stone-800 dark:text-stone-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                Progress &amp; history
              </span>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Mastery by domain · {attempts.length} exam{attempts.length === 1 ? "" : "s"} taken
                {daysRemaining !== null ? ` · ${daysRemaining} days left` : ""}
              </p>
            </div>
            {/* Chevron */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0 text-stone-400 dark:text-stone-600 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all duration-150"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>

        </div>
      </div>
    </main>
  );
}
