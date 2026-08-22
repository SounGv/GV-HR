export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatStep {
  tool: string;
  detail: string;
}

export interface ChatResponse {
  reply: string;
  steps: ChatStep[];
  configured: boolean;
}

export interface AiAccess {
  allowed: boolean;
  scope: "TEAM" | "DEPARTMENT" | "COMPANY";
}
