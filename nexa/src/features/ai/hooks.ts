"use client";

import { useMutation } from "@tanstack/react-query";
import { sendChat } from "./api";
import type { ChatMessage } from "./types";

export function useChat() {
  return useMutation({
    mutationFn: (messages: ChatMessage[]) => sendChat(messages),
  });
}
