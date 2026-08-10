import { api, type Envelope } from "@/lib/api/client";
import type { ChatMessage, ChatResponse } from "./types";

export function sendChat(messages: ChatMessage[]) {
  return api.post<Envelope<ChatResponse>>("/api/ai/chat", { messages });
}
