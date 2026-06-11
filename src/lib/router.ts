import "server-only";
import { anthropic, MODEL_ROUTER } from "./anthropic";
import type { Intent } from "./types";

const ROUTER_SYSTEM_PROMPT = `You are a router for a tutoring app. Classify the user's latest message into exactly one of these intents:

- checkpoint_answer: the user is answering a quiz/MCQ/scenario question the tutor just asked (e.g. "B", "the second one", or a reasoned answer to a posed question).
- doubt: the user is asking a clarifying question or expressing confusion ("wait why is...", "I don't get...", "explain again").
- meta_command: the user is controlling the session itself (start, resume, end, skip, change hour, change style, "I'm tired").
- freeform_chat: anything else: greetings, requests to continue, off-topic, general remarks.

Respond with ONLY a JSON object on a single line, no prose:
{"intent":"<one of the four labels>","confidence":0.0-1.0}`;

type RouterInput = {
  assistantTail: string;
  message: string;
};

export async function classifyIntent({
  assistantTail,
  message,
}: RouterInput): Promise<Intent> {
  try {
    const userMessage = `Last tutor message (truncated to ~400 chars): "${assistantTail.slice(0, 400)}"\nUser message: "${message}"`;

    const response = await anthropic.messages.create({
      model: MODEL_ROUTER,
      max_tokens: 30,
      temperature: 0,
      system: ROUTER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text.trim()) as { intent: string; confidence: number };

    const validIntents: Intent[] = [
      "checkpoint_answer",
      "doubt",
      "meta_command",
      "freeform_chat",
    ];
    if (validIntents.includes(parsed.intent as Intent)) {
      return parsed.intent as Intent;
    }
    return "freeform_chat";
  } catch {
    return "freeform_chat";
  }
}
