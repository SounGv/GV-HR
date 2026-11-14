import { api, type Envelope } from "@/lib/api/client";
import type { AiAccess, AttachmentPayload, ChatMessage, ChatResponse, ConfirmOutcome } from "./types";

export function sendChat(messages: ChatMessage[], attachments?: AttachmentPayload[]) {
  return api.post<Envelope<ChatResponse>>("/api/ai/chat", { messages, ...(attachments && attachments.length > 0 ? { attachments } : {}) });
}

export function fetchAiAccess() {
  return api.get<Envelope<AiAccess>>("/api/ai/access");
}

export function confirmProposal(token: string) {
  return api.post<Envelope<ConfirmOutcome>>("/api/ai/confirm", { token });
}
