"use client";

import { useRef, useState, useEffect } from "react";
import { ArrowUp, Globe, Sparkles, Wrench } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useChat } from "./hooks";
import type { ChatMessage, ChatStep } from "./types";

const SUGGESTIONS = [
  "วันนี้มาสายกี่คน",
  "มีพนักงานทั้งหมดกี่คน แยกตามแผนก",
  "สรุป OT เดือนนี้ พร้อมค่าใช้จ่าย",
  "คำนวณเงินเดือนสุทธิ เงินเดือน 45,000 บาท",
];

interface Turn {
  role: "user" | "assistant";
  content: string;
  steps?: ChatStep[];
}

/** The assistant's face: one teal disc, the same on every message so the thread reads as a conversation. */
function BotAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--chat-teal-bright),var(--chat-teal))] text-white shadow-sm",
        className,
      )}
    >
      <Sparkles className="size-4" />
    </span>
  );
}

export function AiChatView({ className = "h-[calc(100vh-20rem)] min-h-[24rem]" }: { className?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const chat = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, chat.isPending]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || chat.isPending) return;

    const nextTurns: Turn[] = [...turns, { role: "user", content: trimmed }];
    setTurns(nextTurns);
    setInput("");

    const history: ChatMessage[] = nextTurns.map((t) => ({ role: t.role, content: t.content }));
    chat.mutate(history, {
      onSuccess: (res) => {
        setTurns((prev) => [...prev, { role: "assistant", content: res.data.reply, steps: res.data.steps }]);
      },
      onError: () => {
        setTurns((prev) => [
          ...prev,
          { role: "assistant", content: "ขออภัย เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง" },
        ]);
      },
    });
  }

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-muted/30 p-4" aria-live="polite">
        {turns.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <BotAvatar className="size-14 [&>svg]:size-7" />
            <div>
              <p className="text-base font-semibold text-foreground">สวัสดีครับ ผมคือ AI Assistant</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                ดึงข้อมูลจริงจากระบบมาตอบ ช่วยสรุปข้อมูล ค้นเว็บ และส่งการแจ้งเตือนถึงพนักงานได้
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="min-h-11 rounded-full border border-border bg-card px-4 text-sm text-foreground transition hover:border-[var(--chat-teal)] hover:bg-accent hover:text-accent-foreground md:min-h-9 md:px-3.5 md:text-xs"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} className={cn("flex items-end gap-2", t.role === "user" && "justify-end")}>
            {t.role === "assistant" && <BotAvatar />}
            <div className={cn("max-w-[82%] space-y-1.5", t.role === "user" && "flex flex-col items-end")}>
              {t.steps && t.steps.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label="แหล่งข้อมูลที่ใช้ตอบ">
                  {t.steps.map((step, si) => (
                    <li
                      key={si}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground"
                    >
                      {step.tool === "web_search" ? (
                        <Globe className="size-3 shrink-0" aria-hidden="true" />
                      ) : (
                        <Wrench className="size-3 shrink-0" aria-hidden="true" />
                      )}
                      <span className="truncate">{step.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div
                className={cn(
                  "px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap",
                  t.role === "user"
                    ? "rounded-2xl rounded-br-md bg-[var(--chat-teal)] text-white"
                    : "rounded-2xl rounded-bl-md border border-border bg-card text-foreground shadow-sm",
                )}
              >
                {t.content}
              </div>
            </div>
          </div>
        ))}

        {chat.isPending && (
          <div className="flex items-end gap-2" role="status">
            <BotAvatar />
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 shadow-sm">
              <span className="flex gap-1" aria-hidden="true">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="size-2 animate-bounce rounded-full bg-[var(--chat-teal-bright)] motion-reduce:animate-pulse"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
              <span className="text-sm text-muted-foreground">กำลังค้นหาข้อมูล…</span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border bg-card p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex items-end gap-2 rounded-3xl border border-border bg-background p-1.5 pl-4 transition focus-within:border-[var(--chat-teal)] focus-within:ring-3 focus-within:ring-[var(--chat-teal)]/20"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit(input);
              }
            }}
            aria-label="ข้อความถึง AI Assistant"
            placeholder="ถามเรื่องพนักงาน เวลาทำงาน การลา…"
            rows={1}
            className="max-h-32 min-h-11 flex-1 resize-none border-0 bg-transparent px-0 py-2.5 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <button
            type="submit"
            aria-label="ส่งข้อความ"
            disabled={chat.isPending || !input.trim()}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--chat-teal)] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            <ArrowUp className="size-5" />
          </button>
        </form>
        <p className="mt-1.5 hidden px-3 text-xs text-muted-foreground md:block">Enter เพื่อส่ง · Shift+Enter ขึ้นบรรทัดใหม่</p>
      </div>
    </div>
  );
}
