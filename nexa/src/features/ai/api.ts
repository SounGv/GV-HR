import { api, type Envelope } from "@/lib/api/client";
import type { ChatMessage, ChatResponse, EvaluationResponse } from "./types";

export function sendChat(messages: ChatMessage[]) {
  return api.post<Envelope<ChatResponse>>("/api/ai/chat", { messages });
}

export function generateEvaluation(employeeId: string, instruction?: string) {
  return api.post<Envelope<EvaluationResponse>>("/api/ai/evaluation", {
    employeeId,
    instruction,
  });
}
