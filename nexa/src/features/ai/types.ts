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
  /** Files the assistant made for download. */
  files?: OutFile[];
  configured: boolean;
}

export interface AiAccess {
  allowed: boolean;
  scope: "TEAM" | "DEPARTMENT" | "COMPANY";
  /** Whether the chat box shows the attach button. */
  canAttach?: boolean;
}

/** A file the assistant hands back; `data` is base64. */
export interface OutFile {
  name: string;
  mime: string;
  data: string;
}

/** A file the person attached, as the browser sends it. */
export interface AttachmentPayload {
  name: string;
  data: string;
}
