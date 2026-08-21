"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Starts an entirely new 23-hour sprint attempt: Hour 0, every concept's
 * mastery reset to 0%, calendar reset to today + 23 days. Session history and
 * exam attempts are kept as the record of the prior attempt — only "New
 * session" (a separate control) clears the visible chat.
 *
 * This is destructive to mastery, so it confirms before calling the API.
 */
export default function StartNewSprintButton({
  className,
  label = "Start new sprint",
}: {
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (busy) return;
    const confirmed = window.confirm(
      "Start a new 23-hour sprint? This resets your progress to Hour 0 and every " +
        "concept's mastery back to 0%. Past sessions and mock-exam results are kept " +
        "for reference, but your current progress will not be."
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sprint/restart", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Restart failed (${res.status})`);
      }
      router.push("/chat");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restart failed");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button onClick={() => void start()} disabled={busy} className={className}>
        {busy ? "Starting…" : label}
      </button>
      {error && <span className="text-[10px] text-rose-500">{error}</span>}
    </div>
  );
}
