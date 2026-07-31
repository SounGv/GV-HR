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

export interface EvalCompetency {
  name: string;
  description: string;
  weight: number;
}

export interface EvalDraft {
  competencies: EvalCompetency[];
  focus: string;
  rationale: string;
}

export interface EvaluationResponse {
  employee: { name: string; department: string; position: string; level: string | null };
  draft: EvalDraft | null;
  configured: boolean;
}
