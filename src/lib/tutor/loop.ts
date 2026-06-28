import "server-only";
import { anthropic, MODEL_TUTOR } from "@/lib/anthropic";
import { TUTOR_TOOLS } from "./tools";
import { buildPrompt } from "./prompt";
import { executeTool, type ToolContext } from "./tool-handlers";
import type { Intent, LedgerSnapshot, ToolCallLog } from "@/lib/types";
import type {
  MessageParam,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages";
import { fromSdkUsage, addUsage, ZERO_USAGE, type TokenUsage } from "@/lib/billing/usage";

type LoopInput = {
  student: { id: string; currentHour: number };
  session: { id: number };
  hour: number;
  history: MessageParam[];
  intent: Intent;
  message: string;
  ledgerSnapshot: LedgerSnapshot;
  iterationCap?: number;
};

export type LoopEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; name: string }
  | { type: "tool_result"; name: string; isError: boolean }
  | { type: "attempt_graded"; correct: boolean };

type LoopResult = {
  assistantText: string;
  toolCalls: ToolCallLog[];
  stoppedAt: "end_turn" | "stop_sequence" | "iteration_cap";
  usage: TokenUsage;
  model: string;
};

const CAP_MESSAGE =
  "(tutor exceeded tool budget — partial response, please retry)";

export async function runTutorLoop(
  input: LoopInput,
  onEvent?: (event: LoopEvent) => void
): Promise<LoopResult> {
  const cap = input.iterationCap ?? 25;
  const toolCalls: ToolCallLog[] = [];
  const fullText: string[] = [];
  let usage: TokenUsage = ZERO_USAGE;

  const ctx: ToolContext = {
    studentId: input.student.id,
    sessionId: input.session.id,
  };

  const { system, messages: initialMessages } = buildPrompt({
    student: input.student,
    ledgerSnapshot: input.ledgerSnapshot,
    hour: input.hour,
    history: input.history,
    intent: input.intent,
    message: input.message,
  });

  const messages: MessageParam[] = [...initialMessages];

  for (let i = 0; i < cap; i++) {
    const stream = anthropic.messages.stream({
      model: MODEL_TUTOR,
      system,
      messages,
      tools: TUTOR_TOOLS,
      max_tokens: 2048,
    });

    stream.on("text", (delta: string) => {
      fullText.push(delta);
      onEvent?.({ type: "text", delta });
    });

    const response = await stream.finalMessage();
    usage = addUsage(usage, fromSdkUsage(response.usage));

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is ToolUseBlock => b.type === "tool_use"
      );

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
        is_error: boolean;
      }> = [];

      for (const toolUse of toolUseBlocks) {
        onEvent?.({ type: "tool_call", name: toolUse.name });
        const result = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          ctx
        );
        onEvent?.({
          type: "tool_result",
          name: toolUse.name,
          isError: result.isError,
        });

        // Surface checkpoint grading to the client so it can animate the verdict
        // without waiting for the assistant's narrated feedback.
        if (toolUse.name === "record_attempt" && !result.isError) {
          try {
            const parsed = JSON.parse(result.content) as { correct?: boolean };
            if (typeof parsed.correct === "boolean") {
              onEvent?.({ type: "attempt_graded", correct: parsed.correct });
            }
          } catch {
            // record_attempt returned non-JSON; skip the verdict signal.
          }
        }

        toolCalls.push({
          name: toolUse.name,
          input: toolUse.input as Record<string, unknown>,
          output: result.content,
          isError: result.isError,
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result.content,
          is_error: result.isError,
        });
      }

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    if (
      response.stop_reason === "end_turn" ||
      response.stop_reason === "stop_sequence"
    ) {
      return {
        assistantText: fullText.join("").trim(),
        toolCalls,
        stoppedAt: response.stop_reason as "end_turn" | "stop_sequence",
        usage,
        model: MODEL_TUTOR,
      };
    }

    // Unexpected stop reason — treat as end
    return {
      assistantText: fullText.join("").trim(),
      toolCalls,
      stoppedAt: "end_turn",
      usage,
      model: MODEL_TUTOR,
    };
  }

  // Iteration cap exceeded — append marker so retry UI can detect it
  const partial = fullText.join("").trim();
  const capText = partial ? `${partial}\n\n${CAP_MESSAGE}` : CAP_MESSAGE;
  // Also surface the marker to the client stream so it can show it inline.
  onEvent?.({ type: "text", delta: partial ? `\n\n${CAP_MESSAGE}` : CAP_MESSAGE });
  return {
    assistantText: capText,
    toolCalls,
    stoppedAt: "iteration_cap",
    usage,
    model: MODEL_TUTOR,
  };
}
