"use client";

import { useState, useEffect } from "react";

type Option = { key: string; text: string };
type Confidence = "guess" | "maybe" | "sure";

type OptionPickerProps = {
  options: Option[];
  disabled: boolean;
  onSubmit: (answer: string) => void;
};

export default function OptionPicker({
  options,
  disabled,
  onSubmit,
}: OptionPickerProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [reasoning, setReasoning] = useState("");

  // Reset when the option set changes (new question loaded)
  useEffect(() => {
    setSelected(null);
    setConfidence(null);
    setReasoning("");
  }, [options]);

  const handleSubmit = () => {
    if (!selected || !confidence) return;
    const trimmed = reasoning.trim();
    const answer = trimmed
      ? `${selected} [confidence: ${confidence}] — ${trimmed}`
      : `${selected} [confidence: ${confidence}]`;
    onSubmit(answer);
    setSelected(null);
    setConfidence(null);
    setReasoning("");
  };

  const confidenceLevels: { value: Confidence; label: string }[] = [
    { value: "guess", label: "Guess" },
    { value: "maybe", label: "Maybe" },
    { value: "sure", label: "Sure" },
  ];

  return (
    <div className="border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 px-6 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-stone-400 dark:text-stone-500 font-semibold">
          Pick an answer
        </p>
        <p className="text-[10px] text-stone-400 dark:text-stone-500">
          Reasoning is optional
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((opt) => {
          const isSelected = selected === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setSelected(opt.key)}
              disabled={disabled}
              className={`text-left text-sm px-3 py-2 rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isSelected
                  ? "border-stone-800 bg-stone-800 dark:border-stone-100 dark:bg-stone-100 text-stone-50 dark:text-stone-900"
                  : "border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:border-stone-500 dark:hover:border-stone-500"
              }`}
            >
              <span
                className={`inline-block font-mono font-semibold mr-2 ${
                  isSelected
                    ? "text-stone-50 dark:text-stone-900"
                    : "text-stone-500 dark:text-stone-400"
                }`}
              >
                {opt.key})
              </span>
              {opt.text}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] text-stone-400 dark:text-stone-500 shrink-0">
            Confidence:
          </span>
          {confidenceLevels.map(({ value, label }) => {
            const isActive = confidence === value;
            return (
              <button
                key={value}
                onClick={() => setConfidence(value)}
                disabled={disabled}
                className={`text-xs px-2.5 py-1 rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isActive
                    ? "border-stone-800 bg-stone-800 dark:border-stone-100 dark:bg-stone-100 text-stone-50 dark:text-stone-900"
                    : "border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:border-stone-500 dark:hover:border-stone-500"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 items-start pt-1">
        <textarea
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          placeholder="(Optional) Add your reasoning…"
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none rounded border border-stone-300 dark:border-stone-700 px-2 py-1.5 text-sm bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500 max-h-24"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !selected || !confidence}
          className="px-3 py-1.5 rounded bg-stone-800 dark:bg-stone-100 text-stone-50 dark:text-stone-900 text-sm font-medium hover:bg-stone-700 dark:hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

/**
 * Parse A) B) C) D) style options from a markdown message.
 * Accepts lines like:
 *   A) text
 *   **A)** text
 *   - A) text
 * Also tolerates inline runs where the model emits options as one paragraph:
 *   "A) foo B) bar C) baz D) qux"  →  treated as four virtual lines.
 * Returns options in source order. Empty array if none found.
 */
export function parseOptions(content: string): Option[] {
  // Split by newlines, then break any line that runs options inline by
  // inserting a virtual break at whitespace immediately before a non-leading
  // A)/B)/C)/D) marker. A single-line option ("A) text") has no preceding
  // whitespace before its marker, so this never affects properly-formatted lines.
  const lines = content
    .split(/\r?\n/)
    .flatMap((ln) =>
      /\s[A-D]\)\s/.test(ln) ? ln.split(/\s(?=[A-D]\)\s)/) : [ln]
    );
  const re = /^\s*(?:-\s*)?(?:\*\*)?([A-D])\)(?:\*\*)?\s+(.+?)\s*$/;
  const seen = new Set<string>();
  const out: Option[] = [];
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const key = m[1];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, text: m[2] });
  }
  // Only treat as MCQ if we have at least two consecutive options starting at A
  if (out.length < 2 || out[0].key !== "A") return [];
  return out;
}
