"use client";

import { useState } from "react";

/**
 * Closes the current open session (if any) and starts a fresh one.
 * Ending is server-side via /api/session/end; the hard navigation to /chat then
 * lands on a brand-new session because getOrCreateOpenSession finds none open.
 */
export default function NewSessionButton({
  className,
  label = "New session",
}: {
  className?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/session/end", { method: "POST" });
    } catch {
      // Even if the end call fails, a fresh /chat visit resolves the session
      // server-side; fall through to the navigation.
    }
    window.location.assign("/chat");
  };

  return (
    <button onClick={() => void start()} disabled={busy} className={className}>
      {busy ? "Starting…" : label}
    </button>
  );
}
