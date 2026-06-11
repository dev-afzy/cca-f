export type Intent =
  | "checkpoint_answer"
  | "doubt"
  | "meta_command"
  | "freeform_chat";

export type ToolCallLog = {
  name: string;
  input: Record<string, unknown>;
  output: string;
  isError: boolean;
};

export type MasteryEntry = {
  slug: string;
  name: string;
  mastery: number;
  week: number;
  sortOrder: number;
};

export type MasterySnapshot = {
  entries: MasteryEntry[];
  currentHour: number;
  preferredStyle: string[];
  daysElapsed: number;
  daysRemaining: number;
};

export type LedgerSnapshot = {
  daysElapsed: number;
  daysRemaining: number;
  preferredStyle: string[];
  masteryTable: string;
  recentFrictionList: string;
  recentSessionList: string;
  currentHour: number;
};

export type TurnResponse = {
  message: string;
  intent: Intent;
  masterySnapshot: MasterySnapshot;
  toolsCalled: string[];
  currentHour: number;
  stoppedAt: "end_turn" | "stop_sequence" | "iteration_cap";
};
