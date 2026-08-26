"use client";

import { usePathname } from "next/navigation";
import { Bot, X } from "lucide-react";

import { useAiAccess } from "./hooks";
import { AiChatView } from "./ai-chat-view";
import { useAiPanel } from "./ai-panel-context";

/**
 * The floating AI chat panel — desktop only, opened from the sidebar's "AI
 * Assistant" item (see AppSidebar) instead of a persistent corner button
 * (that button sat on top of page content on every screen and collided with
 * sticky save bars). On mobile the bottom nav/drawer already routes to the
 * full /ai page, so this is never shown there.
 */
export function AiChatPanel() {
  const pathname = usePathname();
  const { data: aiAccess } = useAiAccess();
  const { open, closePanel } = useAiPanel();

  if (!open || pathname === "/ai" || !aiAccess?.data.allowed) return null;

  return (
    <div className="fixed right-6 bottom-6 z-50 hidden h-[32rem] w-96 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl md:flex">
      <div className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 text-white">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Bot className="size-4 text-primary" /> AI Assistant
        </span>
        <button
          type="button"
          onClick={closePanel}
          aria-label="ปิด AI Assistant"
          className="rounded-lg p-1 text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>
      <AiChatView className="h-full flex-1 rounded-none border-0 shadow-none" />
    </div>
  );
}
