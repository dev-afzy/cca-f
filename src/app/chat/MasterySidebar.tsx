"use client";

import { useRef, useEffect, useState } from "react";
import type { MasterySnapshot, MasteryEntry } from "@/lib/types";
import NewSessionButton from "../NewSessionButton";

type MasterySidebarProps = {
  snapshot: MasterySnapshot;
  onEndSession: () => void;
  isEnding: boolean;
};

function masteryColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 60) return "bg-sky-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

function masteryTextColor(pct: number): string {
  if (pct >= 80) return "text-emerald-700";
  if (pct >= 60) return "text-sky-700";
  if (pct >= 40) return "text-amber-700";
  return "text-rose-700";
}

function groupByWeek(entries: MasteryEntry[]) {
  const groups: Record<string, MasteryEntry[]> = {
    "Week 1": [],
    "Week 2": [],
    "Week 3": [],
    "Week 4": [],
    "Cross-cutting": [],
  };
  for (const e of entries) {
    if (e.week === 1) groups["Week 1"].push(e);
    else if (e.week === 2) groups["Week 2"].push(e);
    else if (e.week === 3) groups["Week 3"].push(e);
    else if (e.week === 4) groups["Week 4"].push(e);
    else groups["Cross-cutting"].push(e);
  }
  return groups;
}

export default function MasterySidebar({
  snapshot,
  onEndSession,
  isEnding,
}: MasterySidebarProps) {
  const groups = groupByWeek(snapshot.entries);
  const weekLabel =
    snapshot.currentHour <= 7
      ? 1
      : snapshot.currentHour <= 14
        ? 2
        : snapshot.currentHour <= 19
          ? 3
          : 4;

  // Track which slugs are currently pulsing
  const [pulsingSet, setPulsingSet] = useState<Set<string>>(new Set());
  const prevEntriesRef = useRef<Map<string, number>>(new Map());
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      // Seed the ref without triggering pulses
      const initial = new Map<string, number>();
      for (const e of snapshot.entries) {
        initial.set(e.slug, e.mastery);
      }
      prevEntriesRef.current = initial;
      isFirstRender.current = false;
      return;
    }

    const changed: string[] = [];
    for (const e of snapshot.entries) {
      const prev = prevEntriesRef.current.get(e.slug);
      if (prev !== undefined && prev !== e.mastery) {
        changed.push(e.slug);
      }
    }

    // Update prev map
    const next = new Map<string, number>();
    for (const e of snapshot.entries) {
      next.set(e.slug, e.mastery);
    }
    prevEntriesRef.current = next;

    if (changed.length === 0) return;

    setPulsingSet(new Set(changed));
    const timer = setTimeout(() => {
      setPulsingSet(new Set());
    }, 600);
    return () => clearTimeout(timer);
  }, [snapshot.entries]);

  return (
    <aside className="border-l border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
            Progress
          </h2>
          <p className="text-sm text-stone-700 dark:text-stone-200 mt-0.5">
            Hour {snapshot.currentHour} / 23 &middot; Week {weekLabel}
          </p>
          <p className="text-xs text-stone-400 dark:text-stone-500">
            {snapshot.daysRemaining} day{snapshot.daysRemaining === 1 ? "" : "s"} left
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button
            onClick={onEndSession}
            disabled={isEnding}
            className="text-xs px-3 py-1.5 rounded bg-stone-800 dark:bg-stone-100 text-stone-50 dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-200 disabled:opacity-50 transition-colors"
          >
            {isEnding ? "Ending..." : "End session"}
          </button>
          <NewSessionButton
            label="New session"
            className="text-xs px-3 py-1.5 rounded border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50 transition-colors"
          />
        </div>
      </div>

      {/* Preferred style */}
      {snapshot.preferredStyle.length > 0 && (
        <div className="px-4 py-2 border-b border-stone-200 dark:border-stone-800">
          <p className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-1">
            Style
          </p>
          <div className="flex flex-wrap gap-1">
            {snapshot.preferredStyle.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Mastery bars */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {Object.entries(groups).map(([groupLabel, entries]) => {
          if (entries.length === 0) return null;
          return (
            <div key={groupLabel}>
              <h3 className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-2">
                {groupLabel}
              </h3>
              <div className="space-y-2">
                {entries.map((entry) => {
                  const isPulsing = pulsingSet.has(entry.slug);
                  return (
                    <div key={entry.slug}>
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="text-[11px] text-stone-600 dark:text-stone-300 leading-tight">
                          {entry.name}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-semibold ${masteryTextColor(entry.mastery)}`}
                        >
                          {entry.mastery}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${masteryColor(entry.mastery)} ${isPulsing ? "animate-pulse-once" : ""}`}
                          style={{ width: `${entry.mastery}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {snapshot.entries.length === 0 && (
          <p className="text-xs text-stone-400 dark:text-stone-500 italic">
            No mastery data yet. Complete the diagnostic to seed your progress.
          </p>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-stone-200 dark:border-stone-800">
        <div className="flex gap-2 flex-wrap">
          {[
            { label: "Strong ≥80", color: "bg-emerald-500" },
            { label: "Good 60–79", color: "bg-sky-500" },
            { label: "Weak 40–59", color: "bg-amber-500" },
            { label: "Broken <40", color: "bg-rose-500" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${item.color}`} />
              <span className="text-[9px] text-stone-400 dark:text-stone-500">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
