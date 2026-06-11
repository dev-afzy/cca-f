"use client";

import { useState } from "react";

type SyncResult = {
  ok: boolean;
  path?: string;
  bytes?: number;
  error?: string;
};

export function SyncButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<SyncResult | null>(null);

  async function handleSync() {
    setStatus("loading");
    setResult(null);
    try {
      const res = await fetch("/api/ledger/sync", { method: "POST" });
      const data: SyncResult = await res.json();
      setResult(data);
      setStatus(data.ok ? "done" : "error");
    } catch (err) {
      setResult({ ok: false, error: String(err) });
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleSync}
        disabled={status === "loading"}
        className="inline-flex items-center gap-2 px-4 py-2 bg-stone-800 dark:bg-stone-100 text-stone-100 dark:text-stone-900 font-medium text-sm rounded hover:bg-stone-700 dark:hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-fit"
      >
        {status === "loading" ? (
          <>
            <span className="inline-block w-3 h-3 border-2 border-stone-400 border-t-stone-100 rounded-full animate-spin" />
            Syncing…
          </>
        ) : (
          "Sync ledger to disk"
        )}
      </button>

      {status === "done" && result?.ok && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400 font-mono">
          Synced to {result.path} ({result.bytes?.toLocaleString()} bytes)
        </p>
      )}
      {status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400 font-mono">{result?.error ?? "Unknown error"}</p>
      )}
    </div>
  );
}
