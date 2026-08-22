import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export type TutorProvider = "anthropic" | "glm";

// The router (intent classification) always uses this, regardless of the
// student's chosen tutor provider — a small, invisible-to-the-student call;
// doubling the provider surface there has no user-facing benefit.
export const MODEL_ROUTER = "claude-haiku-4-5-20251001";

const TUTOR_MODEL_BY_PROVIDER: Record<TutorProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  glm: "glm-5.3", // confirmed against docs/superpowers/plans/2026-08-22-glm-compat-findings.md
};

type ClientConfig = { apiKey: string | undefined; baseURL?: string };

const CLIENT_CONFIG: Record<TutorProvider, ClientConfig> = {
  anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
  glm: {
    apiKey: process.env.GLM_API_KEY,
    baseURL: process.env.GLM_BASE_URL ?? "https://api.z.ai/api/anthropic",
  },
};

declare global {
  // eslint-disable-next-line no-var
  var __tutorClients: Partial<Record<TutorProvider, Anthropic>> | undefined;
}

const clientCache: Partial<Record<TutorProvider, Anthropic>> =
  globalThis.__tutorClients ?? {};

export function getTutorClient(provider: TutorProvider): Anthropic {
  if (!clientCache[provider]) {
    clientCache[provider] = new Anthropic(CLIENT_CONFIG[provider]);
  }
  return clientCache[provider]!;
}

export function getTutorModel(provider: TutorProvider): string {
  return TUTOR_MODEL_BY_PROVIDER[provider];
}

// Kept for router.ts, which is unaffected by any of the above — it always
// wants the plain Anthropic client under this exact import name.
export const anthropic = getTutorClient("anthropic");

if (process.env.NODE_ENV !== "production") {
  globalThis.__tutorClients = clientCache;
}
