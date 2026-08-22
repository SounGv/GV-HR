import { api, type Envelope } from "@/lib/api/client";
import type { AiAccess, ChatMessage, ChatResponse } from "./types";

export function sendChat(messages: ChatMessage[]) {
  return api.post<Envelope<ChatResponse>>("/api/ai/chat", { messages });
}

export function fetchAiAccess() {
  return api.get<Envelope<AiAccess>>("/api/ai/access");
}
