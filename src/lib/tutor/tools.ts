import type { Tool } from "@anthropic-ai/sdk/resources/messages";

type CacheMarker =
  { cache_control: { type: "ephemeral" } } | Record<string, never>;

function maybeCache(enabled: boolean): CacheMarker {
  return enabled ? { cache_control: { type: "ephemeral" } } : {};
}

export function tutorTools(enableCaching: boolean): Tool[] {
  return [
    {
      name: "read_ledger",
      description:
        "Read the full student ledger: profile, mastery percentages, recent friction points, recent sessions, preferred style, and current hour. Call this at the start of a session to load context.",
      input_schema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "start_session",
      description:
        "Start or resume a tutoring session for the current hour. Returns the sessionId to use in subsequent tool calls.",
      input_schema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "end_session",
      description:
        "End the current session. Write a 3-bullet markdown summary of what was covered and identify one growth area for next session.",
      input_schema: {
        type: "object",
        properties: {
          summaryMd: {
            type: "string",
            description:
              "Markdown summary of the session (3 bullets of what was locked in today).",
          },
          growthArea: {
            type: "string",
            description:
              "The specific concept or sub-topic to focus on next session.",
          },
        },
        required: ["summaryMd", "growthArea"],
      },
    },
    {
      name: "update_mastery",
      description:
        "Set a concept's mastery percentage to an absolute value (0–100). Use this to record mastery from diagnostic grading or explicit assessment results.",
      input_schema: {
        type: "object",
        properties: {
          conceptSlug: {
            type: "string",
            description: "The concept slug (must be one of the valid slugs).",
          },
          newPct: {
            type: "number",
            description: "New mastery percentage, 0–100.",
          },
          reason: {
            type: "string",
            description:
              "Why this mastery level is being set (e.g. 'diagnostic-question-1', 'checkpoint-correct', 'remediation-block').",
          },
        },
        required: ["conceptSlug", "newPct", "reason"],
      },
    },
    {
      name: "log_friction",
      description:
        "Record a friction point: the student struggled with a specific concept. Include the concept slug, a description of what tripped them, and a style note if a pivot helped.",
      input_schema: {
        type: "object",
        properties: {
          conceptSlug: {
            type: "string",
            description:
              "The concept slug the friction is about. Optional — omit for general friction.",
          },
          description: {
            type: "string",
            description: "What specifically tripped the student.",
          },
          styleNote: {
            type: "string",
            description:
              "Teaching style observation (e.g., 'analogy helped', 'code snippet confused them').",
          },
        },
        required: ["description"],
      },
    },
    {
      name: "log_misconception",
      description:
        "Record an active misconception — a wrong mental model the student holds. These persist across sessions and should be confronted later.",
      input_schema: {
        type: "object",
        properties: {
          belief: {
            type: "string",
            description: "A concise statement of the wrong belief.",
          },
        },
        required: ["belief"],
      },
    },
    {
      name: "close_misconception",
      description:
        "Mark an open misconception as resolved. Use this when the student has demonstrably corrected their mental model.",
      input_schema: {
        type: "object",
        properties: {
          misconceptionId: {
            type: "number",
            description: "The numeric ID of the misconception to close.",
          },
        },
        required: ["misconceptionId"],
      },
    },
    {
      name: "mark_strong_area",
      description:
        "Promote a concept to the student's strong areas. Use this when mastery is ≥80% and confirmed across at least two checkpoints.",
      input_schema: {
        type: "object",
        properties: {
          conceptSlug: {
            type: "string",
            description: "The concept slug to mark as strong.",
          },
        },
        required: ["conceptSlug"],
      },
    },
    {
      name: "fetch_question",
      description:
        "Fetch a question from the question bank for a given concept slug. Returns the question stem, options, and question ID for use with record_attempt.",
      input_schema: {
        type: "object",
        properties: {
          conceptSlug: {
            type: "string",
            description: "The concept slug to fetch a question for.",
          },
          difficulty: {
            type: "string",
            enum: ["warmup", "hard"],
            description:
              "Optional tier filter. Use 'warmup' for in-hour checkpoints; use 'hard' for mock exams (Hours 7, 14, 23, 24). In a mock hour the handler defaults difficulty to \"hard\" and noRepeat to true when omitted; pass \"warmup\" explicitly only for post-mock remediation.",
          },
          noRepeat: {
            type: "boolean",
            description:
              "Set true during mocks. Excludes any question already fetched this session; on exhaustion returns exhausted:true (generate a fresh question) instead of re-serving a duplicate.",
          },
        },
        required: ["conceptSlug"],
      },
    },
    {
      name: "record_attempt",
      description:
        "Record the student's answer to a question. Grades automatically and nudges mastery (+5 for correct, -5 for incorrect). Returns grading result.",
      input_schema: {
        type: "object",
        properties: {
          questionId: {
            type: "number",
            description: "The numeric question ID from fetch_question.",
          },
          chosenKey: {
            type: "string",
            enum: ["A", "B", "C", "D"],
            description: "The answer key the student chose.",
          },
          reasoning: {
            type: "string",
            description: "The student's reasoning for their answer.",
          },
        },
        required: ["questionId", "chosenKey"],
      },
    },
    {
      name: "advance_hour",
      description:
        "Advance the student to the next hour. Use after the diagnostic (Hour 0 to 1) or once a session is complete. PRECONDITION, enforced: the current hour must already have its recorded checkpoints — 3 graded answers for a normal hour, 10 for the mini-mock hours 7 and 14, and a completed 60-question mock for hours 23 and 24. If the requirement is unmet this returns advanced:false with how many remain; run them via fetch_question + record_attempt and call again. A wrong answer still counts.",
      input_schema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "set_preferred_style",
      description:
        "Update the student's preferred teaching style tags. Replaces the existing list.",
      input_schema: {
        type: "object",
        properties: {
          tags: {
            type: "array",
            items: { type: "string" },
            description:
              "Array of style tags (e.g., ['Analogy-heavy', 'Code-heavy', 'Terse']).",
          },
        },
        required: ["tags"],
      },
      ...maybeCache(enableCaching),
    },
  ];
}
