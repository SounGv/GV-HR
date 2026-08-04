"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, X } from "lucide-react";

import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";
import { AiChatView } from "./ai-chat-view";

/**
 * Persistent AI Assistant entry point mounted once in the app shell — a
 * floating launcher on every page (except /ai itself, which is already the
 * full chat experience) so the user can ask a question without leaving
 * whatever they're doing.
 */
export function FloatingAiLauncher() {
  const pathname = usePathname();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);

  if (pathname === "/ai" || !can("ai:read")) return null;

  return (
    <>
      {open && (
        <div
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl",
            "inset-x-3 bottom-20 top-16 md:inset-auto md:right-6 md:bottom-24 md:h-[32rem] md:w-96",
          )}
        >
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
        className={cn(
          "fixed right-5 bottom-20 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-95 md:bottom-6",
          open && "hidden md:flex",
        )}
      >
        {open ? <X className="size-6" /> : <Bot className="size-6" />}
      </button>
    </>
  );
}
