"use client";

import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";

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
    <div
      role="dialog"
      aria-label="AI Assistant"
      className="fixed right-6 bottom-6 z-50 hidden h-[34rem] w-[24rem] flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl md:flex"
    >
      <div className="flex items-center gap-3 bg-[var(--chat-teal)] px-4 py-3 text-white">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25" aria-hidden="true">
          <Sparkles className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-tight font-semibold">AI Assistant</p>
          <p className="text-xs leading-tight text-white/85">ผู้ช่วยงาน HR ตอบจากข้อมูลจริง</p>
        </div>
        <button
          type="button"
          onClick={closePanel}
          aria-label="ปิด AI Assistant"
          className="flex size-11 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15 hover:text-white md:size-9"
        >
          <X className="size-5" />
        </button>
      </div>
      <AiChatView className="h-full flex-1 rounded-none border-0 shadow-none" />
    </div>
  );
}
