import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export type TutorProvider = "anthropic" | "glm";

// The router (intent classification) always uses this, regardless of the
// student's chosen tutor provider — a small, invisible-to-the-student call;
// doubling the provider surface there has no user-facing benefit.
export const MODEL_ROUTER = "claude-haiku-4-5-20251001";

const TUTOR_MODEL_BY_PROVIDER: Record<TutorProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  // Model id and pricing are sourced from public announcements; live-confirmed
  // so far only on the one behavior below (thinking cannot be disabled). See
  // docs/BACKLOG.md for the remaining unverified-value follow-up.
  glm: "glm-5.3",
};

// GLM-5.3 always reasons and rejects a request with no `thinking` config as
// if reasoning were disabled — confirmed live against api.z.ai (error 1210:
// "This model always engages in thinking and cannot be disabled; please use
// low, high, or max"). Z.ai's Anthropic-compatible endpoint takes
// `thinking: { type: "enabled" }` plus this separate `reasoning_effort`
// field (low/high/max — not part of Anthropic's own Messages API schema).
// "low" trades reasoning depth for latency/cost, appropriate for a chat-style
// tutoring turn where the loop can already run up to 25 iterations.
export const GLM_REASONING_EFFORT = "low";

type ClientConfig = { apiKey: string | null | undefined; baseURL?: string };

const CLIENT_CONFIG: Record<TutorProvider, ClientConfig> = {
  anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
  glm: {
    // `?? null` (not `undefined`) is deliberate: the @anthropic-ai/sdk client
    // falls back to reading ANTHROPIC_API_KEY from the environment when
    // `apiKey` is undefined. Since baseURL below points at Z.ai, that
    // fallback would send the owner's real Anthropic key to a third party as
    // X-Api-Key. Passing `null` skips the fallback — an unconfigured
    // GLM_API_KEY throws a clear auth error instead of leaking the wrong key.
    apiKey: process.env.GLM_API_KEY ?? null,
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

// Single source of truth for validating a student's stored preferredProvider
// at read time, instead of an unchecked `as "anthropic" | "glm"` cast in each
// turn route. If GLM_API_KEY was rotated out (or is absent in this
// environment) after a student picked "glm", fail over to "anthropic" here —
// clearly and early — rather than letting the (now-hardened, see
// CLIENT_CONFIG.glm above) GLM client throw deeper in the tutor loop.
export function resolveProvider(raw: string): TutorProvider {
  if (raw === "anthropic") return "anthropic";

  if (raw === "glm") {
    // Trimmed check: a whitespace-only GLM_API_KEY is not "configured" —
    // must agree with the same check in settings/page.tsx and
    // api/settings/provider/route.ts.
    if (process.env.GLM_API_KEY?.trim()) return "glm";
    console.warn(
      "[resolveProvider] student preferredProvider is \"glm\" but GLM_API_KEY is not configured in this environment — falling back to anthropic"
    );
    return "anthropic";
  }

  console.warn(
    `[resolveProvider] unrecognized preferredProvider "${raw}" — falling back to anthropic`
  );
  return "anthropic";
}

// Kept for router.ts, which is unaffected by any of the above — it always
// wants the plain Anthropic client under this exact import name.
export const anthropic = getTutorClient("anthropic");

if (process.env.NODE_ENV !== "production") {
  globalThis.__tutorClients = clientCache;
}
