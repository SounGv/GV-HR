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
  /** "fallback" when the quick actions answered or should be used from now on. */
  engine?: "ai" | "fallback";
  fallbackReason?: "credit" | "key" | "cap";
  configured: boolean;
}

export interface AiAccess {
  allowed: boolean;
  scope: "TEAM" | "DEPARTMENT" | "COMPANY";
  /** Whether the chat box shows the attach button. */
  canAttach?: boolean;
  /** Administrators (may edit employees): see the AI settings page. */
  canManage?: boolean;
  /** Who answers now: the AI service, or the built-in quick actions. */
  engine?: { mode: "ai" | "fallback"; reason?: "credit" | "key" | "cap"; used: number; cap: number | null };
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

/** What the quick actions (no AI) are asked and what they answer. Mirrors src/lib/ai/quick.ts. */
export interface QuickRequest {
  action: "late_today" | "absent_today" | "pending_approvals" | "leave_quota" | "shifts_week" | "eval_progress" | "announce" | "notify";
  name?: string;
  title?: string;
  body?: string;
  target?: string;
}

export type QuickResponse =
  | { ok: true; markdown: string; proposals: ProposalCard[] }
  | { ok: false; message: string; needs?: "name" };
