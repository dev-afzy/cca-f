"use client";

import { useState } from "react";

const PROVIDERS = [
  { id: "anthropic", label: "Claude (Sonnet)", note: "The model this curriculum is built and tested against." },
  { id: "glm", label: "GLM-5.3", note: "A separate model explaining the same Claude-specific material — answers may differ from Claude's own." },
] as const;

export default function ProviderPicker({ initialProvider }: { initialProvider: string }) {
  const [selected, setSelected] = useState(initialProvider);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (provider: string) => {
    if (provider === selected || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setSelected(provider);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          onClick={() => void choose(p.id)}
          disabled={saving}
          className={`text-left rounded-xl border p-4 transition-colors disabled:opacity-50 ${
            selected === p.id
              ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
              : "border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-900"
          }`}
        >
          <div className="font-medium text-sm text-stone-800 dark:text-stone-100">{p.label}</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">{p.note}</div>
        </button>
      ))}
      {error && <span className="text-[11px] text-rose-500">{error}</span>}
    </div>
  );
}
