"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { sendChat, fetchAiAccess, runQuick } from "./api";
import type { AttachmentPayload, ChatMessage, QuickRequest } from "./types";

export function useChat() {
  return useMutation({
    mutationFn: ({ messages, attachments }: { messages: ChatMessage[]; attachments?: AttachmentPayload[] }) => sendChat(messages, attachments),
  });
}

/**
 * Whether the current user can reach the AI Assistant at all (role
 * permission OR an HR-granted per-employee override) — a grant-only user
 * has no ai:* key in their JWT claims, so nav/launcher visibility can't
 * rely on `can("ai:read")` alone. Cached briefly since it rarely changes
 * mid-session, but not so long that a fresh HR grant/revoke stays stale.
 */
export function useAiAccess() {
  return useQuery({
    queryKey: ["ai", "access"],
    queryFn: fetchAiAccess,
    staleTime: 60_000,
  });
}

/** The quick actions: answered from our own data with no AI, so they work while the AI service is down. */
export function useQuick() {
  return useMutation({ mutationFn: (request: QuickRequest) => runQuick(request) });
}
