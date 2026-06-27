"use client";

import { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import MessageBubble from "./MessageBubble";
import MasterySidebar from "./MasterySidebar";
import OptionPicker, { parseOptions } from "./OptionPicker";
import ThemeToggle from "../ThemeToggle";
import type { MasterySnapshot } from "@/lib/types";

type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; name: string }
  | { type: "tool_result"; name: string; isError: boolean }
  | { type: "attempt_graded"; correct: boolean }
  | {
      type: "done";
      message: string;
      intent: string;
      masterySnapshot: MasterySnapshot;
      toolsCalled: string[];
      currentHour: number;
      stoppedAt: "end_turn" | "stop_sequence" | "iteration_cap";
    }
  | { type: "error"; message: string };

async function* readNdjson(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      const tail = buffer.trim();
      if (tail) {
        try {
          yield JSON.parse(tail) as StreamEvent;
        } catch {
          // skip malformed trailing line
        }
      }
      return;
    }
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        yield JSON.parse(line) as StreamEvent;
      } catch {
        // skip malformed line
      }
    }
  }
}

export type ToolChip = { name: string; status: "running" | "done" | "error" };

type Message = {
  id?: number;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  toolsCalled?: ToolChip[];
  stoppedAt?: "end_turn" | "stop_sequence" | "iteration_cap";
  grading?: "correct" | "incorrect";
};

type ChatClientProps = {
  initialMessages: Array<{
    id: number;
    role: "user" | "assistant";
    content: string;
    stoppedAt?: "end_turn" | "stop_sequence" | "iteration_cap";
  }>;
  initialMastery: MasterySnapshot;
  studentName: string;
};

function ChatClientInner({
  initialMessages,
  initialMastery,
  studentName,
}: ChatClientProps) {
  const searchParams = useSearchParams();
  const showDebug = searchParams.get("debug") === "1";
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [mastery, setMastery] = useState<MasterySnapshot>(initialMastery);
  const [currentHour, setCurrentHour] = useState(initialMastery.currentHour);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Consumes an NDJSON stream from /api/turn or /api/turn/retry, applying live
  // updates to the trailing assistant message. Throws on `error` events so the
  // caller's catch block runs.
  const consumeStream = async (body: ReadableStream<Uint8Array>) => {
    const liveTools: ToolChip[] = [];
    let liveText = "";

    const writeChips = () => {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          next[next.length - 1] = { ...last, toolsCalled: [...liveTools] };
        }
        return next;
      });
    };

    for await (const event of readNdjson(body)) {
      if (event.type === "text") {
        liveText += event.delta;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = { ...last, content: liveText };
          }
          return next;
        });
      } else if (event.type === "tool_call") {
        liveTools.push({ name: event.name, status: "running" });
        writeChips();
      } else if (event.type === "tool_result") {
        // Mark the most recent still-running chip with this name. Walk from the
        // tail so parallel calls of the same tool resolve in arrival order.
        for (let i = liveTools.length - 1; i >= 0; i--) {
          if (liveTools[i].name === event.name && liveTools[i].status === "running") {
            liveTools[i] = {
              name: event.name,
              status: event.isError ? "error" : "done",
            };
            break;
          }
        }
        writeChips();
      } else if (event.type === "attempt_graded") {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              grading: event.correct ? "correct" : "incorrect",
            };
          }
          return next;
        });
      } else if (event.type === "done") {
        // Backstop: any chip still "running" gets marked "done" so the bubble
        // never ends with a pulsing chip. If the server reports tools we never
        // saw streamed (defensive), materialize them as completed.
        const finalChips: ToolChip[] =
          liveTools.length > 0
            ? liveTools.map((t) =>
                t.status === "running" ? { name: t.name, status: "done" as const } : t
              )
            : event.toolsCalled.map((name) => ({ name, status: "done" as const }));
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content: event.message,
              intent: event.intent,
              toolsCalled: finalChips,
              stoppedAt: event.stoppedAt,
            };
          }
          return next;
        });
        setMastery(event.masterySnapshot);
        setCurrentHour(event.currentHour);
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    }
  };

  const sendMessage = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || isLoading) return;

    setError(null);
    setInput("");
    setIsLoading(true);

    // Optimistically add user message + an empty assistant placeholder for streaming
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch("/api/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok || !res.body) {
        const errBody = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }

      await consumeStream(res.body);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      // Remove optimistic user + assistant placeholder on error
      setMessages((prev) => prev.slice(0, -2));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleFormSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    void sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  // Detect MCQ options in the latest assistant message
  const mcqOptions = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "user") return [];
      if (m.role === "assistant") return parseOptions(m.content);
    }
    return [];
  }, [messages]);

  const handleRetry = async () => {
    if (isLoading) return;
    setError(null);
    setIsLoading(true);

    // Reset the trailing assistant bubble to an empty placeholder for streaming
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === "assistant") {
          next[i] = { role: "assistant", content: "" };
          return next;
        }
      }
      next.push({ role: "assistant", content: "" });
      return next;
    });

    try {
      const res = await fetch("/api/turn/retry", { method: "POST" });
      if (!res.ok || !res.body) {
        const errBody = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }
      await consumeStream(res.body);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (isEnding) return;
    setIsEnding(true);
    setError(null);
    try {
      const res = await fetch("/api/session/end", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `End session failed (${res.status})`);
      }
      // Success: the session is marked ended in the DB (no data is deleted).
      // Navigate to the ledger so this session — and every prior one — stays
      // visible for reference. Returning to /chat starts a fresh session.
      router.push("/ledger");
    } catch (e) {
      // Surface failures instead of swallowing them, and re-enable the button
      // so the user can retry. On success we navigate away, so isEnding stays
      // true until the route changes.
      setError(e instanceof Error ? e.message : String(e));
      setIsEnding(false);
    }
  };

  return (
    <div className="grid grid-cols-[1fr_320px] min-h-screen">
      {/* Chat panel */}
      <div className="flex flex-col h-screen">
        {/* Chat header */}
        <div className="border-b border-stone-200 dark:border-stone-800 px-6 py-3 bg-white dark:bg-stone-900 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-stone-800 dark:text-stone-100">CCA-F Tutor</h1>
            <p className="text-xs text-stone-400 dark:text-stone-500">
              {studentName} &middot; Hour {currentHour} / 23
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto bg-stone-50 dark:bg-stone-900">
          <div className="max-w-3xl mx-auto px-6 py-4 w-full">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-stone-400 dark:text-stone-500">
                <p className="text-sm">Say hi to start your session.</p>
                <p className="text-xs mt-1">
                  Hour 0 begins with the diagnostic battery.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isLastAssistant =
              msg.role === "assistant" &&
              i === messages.length - 1;
            return (
              <MessageBubble
                key={msg.id ?? `local-${i}`}
                role={msg.role}
                content={msg.content}
                intent={msg.intent}
                toolsCalled={msg.toolsCalled}
                stoppedAt={msg.stoppedAt}
                grading={msg.grading}
                isStreaming={isLastAssistant && isLoading}
                showDebug={showDebug}
                onRetry={
                  isLastAssistant && msg.stoppedAt === "iteration_cap" && !isLoading
                    ? handleRetry
                    : undefined
                }
              />
            );
          })}

          <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mb-2 px-4 py-2 rounded bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* MCQ option picker (shown when the latest assistant message has A/B/C/D options) */}
        {mcqOptions.length > 0 && (
          <OptionPicker
            options={mcqOptions}
            disabled={isLoading}
            onSubmit={(answer) => void sendMessage(answer)}
          />
        )}

        {/* Input area */}
        <div className="border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-6 py-3">
          <form onSubmit={handleFormSubmit} className="flex gap-2 items-end">
            <div className="flex-1 flex flex-col gap-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question, explain in your own words, or click an option above"
                rows={1}
                className="w-full resize-none rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 max-h-32 overflow-y-auto"
                style={{ minHeight: "40px" }}
                disabled={isLoading}
              />
              <p className="text-[10px] text-stone-400 dark:text-stone-500">
                Enter to send &middot; Shift+Enter for newline
              </p>
            </div>
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 rounded-lg bg-stone-800 dark:bg-stone-100 text-stone-50 dark:text-stone-900 text-sm font-medium hover:bg-stone-700 dark:hover:bg-stone-200 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 12 0 12 12h-4z"
                    />
                  </svg>
                  Thinking
                </>
              ) : (
                "Send"
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Sidebar */}
      <MasterySidebar
        snapshot={mastery}
        onEndSession={() => void handleEndSession()}
        isEnding={isEnding}
      />
    </div>
  );
}

export default function ChatClient(props: ChatClientProps) {
  return (
    <Suspense>
      <ChatClientInner {...props} />
    </Suspense>
  );
}
