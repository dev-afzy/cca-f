"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartExamButton() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/exam/start", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Start failed (${res.status})`);
      }
      const { attemptId } = (await res.json()) as { attemptId: number };
      router.push(`/exam/${attemptId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={() => void start()}
        disabled={starting}
        className="px-8 py-3 bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900 rounded-lg font-semibold text-sm hover:bg-stone-700 dark:hover:bg-stone-200 transition-colors disabled:opacity-60"
      >
        {starting ? "Starting…" : "Start exam"}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
