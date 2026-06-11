import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const MODEL_TUTOR = "claude-sonnet-4-6";
export const MODEL_ROUTER = "claude-haiku-4-5-20251001";

function createAnthropicClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

declare global {
  // eslint-disable-next-line no-var
  var __anthropic: Anthropic | undefined;
}

export const anthropic = globalThis.__anthropic ?? createAnthropicClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__anthropic = anthropic;
}
