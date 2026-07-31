"use client";

import { useMutation } from "@tanstack/react-query";
import { sendChat, generateEvaluation } from "./api";
import type { ChatMessage } from "./types";

export function useChat() {
  return useMutation({
    mutationFn: (messages: ChatMessage[]) => sendChat(messages),
  });
}

export function useGenerateEvaluation() {
  return useMutation({
    mutationFn: (input: { employeeId: string; instruction?: string }) =>
      generateEvaluation(input.employeeId, input.instruction),
  });
}
