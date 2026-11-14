import type { ProposalCard } from "./proposal";

export type { ProposalCard, ConfirmOutcome } from "./proposal";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatStep {
  tool: string;
  detail: string;
  /** Set when the step read an HR report, so the UI can link to it. */
  report?: { type: string; period?: string };
}

export interface ChatResponse {
  reply: string;
  steps: ChatStep[];
  /** Cards to confirm before anything is sent or published. */
  proposals?: ProposalCard[];
  configured: boolean;
}

export interface AiAccess {
  allowed: boolean;
  scope: "TEAM" | "DEPARTMENT" | "COMPANY";
}
