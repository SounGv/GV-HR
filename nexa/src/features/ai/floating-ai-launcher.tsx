"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, X } from "lucide-react";

import { useAuth } from "@/features/auth/auth-context";
import { AiChatView } from "./ai-chat-view";

/**
 * Persistent AI Assistant entry point mounted once in the app shell — a
 * floating launcher, desktop only. On mobile the bottom nav already has a
 * dedicated "AI" tab to the full /ai page, so a floating button here would
 * just be redundant clutter overlapping page content.
 */
export function FloatingAiLauncher() {
  const pathname = usePathname();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);

  if (pathname === "/ai" || !can("ai:read")) return null;

  return (
    <div className="hidden md:block">
      {open && (
        <div className="fixed right-6 bottom-24 z-50 flex h-[32rem] w-96 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 text-white">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Bot className="size-4 text-primary" /> AI Assistant
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="ปิด AI Assistant"
              className="rounded-lg p-1 text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
          <AiChatView className="h-full flex-1 rounded-none border-0 shadow-none" />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "ปิด AI Assistant" : "เปิด AI Assistant"}
        className="fixed right-6 bottom-6 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-95"
      >
        {open ? <X className="size-6" /> : <Bot className="size-6" />}
      </button>
    </div>
  );
}
