"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { ToolChip } from "./ChatClient";

type MessageBubbleProps = {
  role: "user" | "assistant";
  content: string;
  intent?: string;
  toolsCalled?: ToolChip[];
  stoppedAt?: "end_turn" | "stop_sequence" | "iteration_cap";
  grading?: "correct" | "incorrect";
  onRetry?: () => void;
  isStreaming?: boolean;
  showDebug?: boolean;
};

// 8 directions for the celebration spark burst. Distances mixed for an organic
// (non-perfectly-radial) feel.
const SPARK_VECTORS: Array<[number, number]> = [
  [60, 0], [42, -42], [0, -70], [-42, -42],
  [-60, 0], [-42, 42], [0, 70], [42, 42],
];

const CHIP_STYLES: Record<ToolChip["status"], string> = {
  running:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-900/60 animate-pulse",
  done: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200/60 dark:border-sky-900/60",
  error:
    "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200/60 dark:border-red-900/60",
};

const CHIP_ICON: Record<ToolChip["status"], string> = {
  running: "↻",
  done: "✓",
  error: "!",
};

const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-100 px-1 py-0.5 rounded text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <pre className="bg-stone-100 dark:bg-stone-900 text-stone-800 dark:text-stone-200 p-3 rounded-md overflow-x-auto my-2 border border-stone-200 dark:border-stone-700">
        <code className="font-mono text-sm" {...props}>
          {children}
        </code>
      </pre>
    );
  },
  p({ children }) {
    return <p className="mb-2 last:mb-0">{children}</p>;
  },
  ul({ children }) {
    return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
  },
  li({ children }) {
    return <li>{children}</li>;
  },
  h1({ children }) {
    return <h1 className="text-lg font-bold mb-2">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-base font-bold mb-2">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-sm font-bold mb-1">{children}</h3>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-4 border-stone-300 dark:border-stone-700 pl-3 italic text-stone-600 dark:text-stone-300 my-2">
        {children}
      </blockquote>
    );
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="text-sm border-collapse w-full">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-stone-300 dark:border-stone-700 px-2 py-1 bg-stone-100 dark:bg-stone-800 font-semibold text-left">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border border-stone-300 dark:border-stone-700 px-2 py-1">{children}</td>
    );
  },
};

export default function MessageBubble({
  role,
  content,
  intent,
  toolsCalled,
  stoppedAt,
  grading,
  onRetry,
  isStreaming,
  showDebug = false,
}: MessageBubbleProps) {
  const isUser = role === "user";
  const showStreamingDots = !isUser && isStreaming && content.length === 0;

  // Persistent ring tint that lingers on the bubble after grading lands.
  const gradingRing =
    grading === "correct"
      ? "ring-2 ring-emerald-400/40 dark:ring-emerald-500/40"
      : grading === "incorrect"
        ? "ring-2 ring-rose-400/40 dark:ring-rose-500/40"
        : "";
  const shakeClass = grading === "incorrect" ? "animate-wrong-shake" : "";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`relative rounded-lg px-4 py-3 text-[15px] leading-relaxed ${gradingRing} ${shakeClass} ${
          isUser
            ? "max-w-[68ch] bg-stone-800 dark:bg-stone-700 text-stone-50"
            : "max-w-[68ch] bg-white dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-300"
        }`}
      >
        {/* One-shot ring burst — scales + fades outward when grading first lands. */}
        {grading && (
          <span
            className={`pointer-events-none absolute inset-0 rounded-lg border-2 animate-ring-burst ${
              grading === "correct" ? "border-emerald-400" : "border-rose-400"
            }`}
            aria-hidden
          />
        )}

        {/* Spark burst (correct only). 8 dots fly outward from center. */}
        {grading === "correct" && (
          <span className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
            {SPARK_VECTORS.map(([tx, ty], i) => (
              <span
                key={i}
                className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 dark:bg-emerald-300 animate-spark"
                style={{ ["--tx" as string]: `${tx}px`, ["--ty" as string]: `${ty}px` } as React.CSSProperties}
              />
            ))}
          </span>
        )}

        {/* Persistent verdict banner — pops in once, stays. */}
        {grading && !isUser && (
          <div
            className={`mb-2 inline-flex items-center gap-1.5 text-xs font-semibold animate-verdict-pop ${
              grading === "correct"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            <span aria-hidden className="text-base leading-none">
              {grading === "correct" ? "✓" : "✗"}
            </span>
            {grading === "correct" ? "Correct" : "Not quite"}
          </div>
        )}

        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : showStreamingDots ? (
          <div className="flex gap-1 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-500 animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-500 animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-500 animate-bounce" />
          </div>
        ) : (
          <div className="max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {content}
            </ReactMarkdown>
            {/* Mid-stream activity indicator: kept visible whenever the stream is
                live, even while text is partially rendered or a tool is in flight. */}
            {isStreaming && (
              <div
                className="mt-1 inline-flex gap-1 items-center text-stone-400 dark:text-stone-500"
                aria-label="Tutor is working"
              >
                <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1 h-1 rounded-full bg-current animate-bounce" />
              </div>
            )}
          </div>
        )}

        {/* Tool activity chips — always visible (running / done / error). */}
        {!isUser && toolsCalled && toolsCalled.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {toolsCalled.map((t, i) => (
              <span
                key={`${t.name}-${i}`}
                className={`text-[10px] px-1.5 py-0.5 rounded border font-mono inline-flex items-center gap-1 ${CHIP_STYLES[t.status]}`}
              >
                <span aria-hidden>{CHIP_ICON[t.status]}</span>
                {t.name}
              </span>
            ))}
          </div>
        )}

        {/* Debug-only badges (intent classification). */}
        {showDebug && !isUser && intent && (
          <div className="mt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 font-mono">
              intent: {intent}
            </span>
          </div>
        )}

        {!isUser && stoppedAt === "iteration_cap" && onRetry && (
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={onRetry}
              className="text-xs px-2.5 py-1 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900 font-medium transition-colors"
            >
              Retry
            </button>
            <span className="text-[10px] text-stone-400 dark:text-stone-500">
              Tool budget exhausted — re-run this turn.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
