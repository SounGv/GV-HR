"use client";

import { useRef, useState, useEffect } from "react";
import { Bot, Send, User, Wrench, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useChat } from "./hooks";
import type { ChatMessage, ChatStep } from "./types";

const SUGGESTIONS = [
  "มีพนักงานทั้งหมดกี่คน แยกตามแผนก",
  "คำนวณเงินเดือนสุทธิ เงินเดือน 45,000 บาท",
  "สรุป OT เดือนนี้ พร้อมค่าใช้จ่าย",
  "ประกาศวันหยุดสงกรานต์ให้พนักงานทุกคน",
];

interface Turn {
  role: "user" | "assistant";
  content: string;
  steps?: ChatStep[];
}

export function AiChatView() {
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
        setTurns((prev) => [
          ...prev,
          { role: "assistant", content: res.data.reply, steps: res.data.steps },
        ]);
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
    <Card className="flex h-[calc(100vh-20rem)] min-h-[24rem] flex-col overflow-hidden p-0">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {turns.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
              <Bot className="size-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">สวัสดีครับ ผมคือ NEXA AI</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                ผู้ช่วยงาน HR ที่ดึงข้อมูลจริงจากระบบมาตอบ ช่วยสรุปข้อมูล ค้นเว็บ
                และส่งการแจ้งเตือนถึงพนักงานได้
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} className={`flex gap-3 ${t.role === "user" ? "justify-end" : ""}`}>
            {t.role === "assistant" && (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="size-4 text-primary" />
              </div>
            )}
            <div className={`max-w-[80%] space-y-2 ${t.role === "user" ? "order-first" : ""}`}>
              {t.steps && t.steps.length > 0 && (
                <div className="space-y-1">
                  {t.steps.map((step, si) => (
                    <div
                      key={si}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      {step.tool === "web_search" ? (
                        <Globe className="size-3" />
                      ) : (
                        <Wrench className="size-3" />
                      )}
                      <span>{step.detail}</span>
                    </div>
                  ))}
                </div>
              )}
              <div
                className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                  t.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {t.content}
              </div>
            </div>
            {t.role === "user" && (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <User className="size-4" />
              </div>
            )}
          </div>
        ))}

        {chat.isPending && (
          <div className="flex gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="size-4 text-primary" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              กำลังค้นหาข้อมูล…
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex items-end gap-2"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            placeholder="ถาม NEXA AI… (Enter เพื่อส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
            rows={1}
            className="max-h-32 min-h-10 resize-none"
          />
          <Button type="submit" size="icon" disabled={chat.isPending || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}
