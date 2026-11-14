"use client";

import { useRef, useState, useEffect } from "react";
import { ArrowUp, FileSpreadsheet, Globe, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { VBot, type VBotMood } from "@/components/shared/v-bot";
import { MarkdownLite } from "./markdown-lite";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAiAccess, useChat, useQuick } from "./hooks";
import { EngineBadge, FallbackBanner, QuickChips, QuickForm, useEngineMode } from "./fallback-ui";
import { FALLBACK_NOT_UNDERSTOOD } from "./engine-state";
import { parseQuickCommand } from "./quick-actions";
import { ApiError } from "@/lib/api/client";
import { AttachButton, AttachTray, FileDownloads, SentFiles, useAttachments } from "./attachments-ui";
import { playReplyChime, unlockReplyChime } from "./reply-chime";
import { ProposalCards } from "./proposal-cards";
import type { ChatMessage, ChatStep, OutFile, ProposalCard, QuickRequest } from "./types";

const SUGGESTIONS = [
  "วันนี้มาสายกี่คน",
  "มีพนักงานทั้งหมดกี่คน แยกตามแผนก",
  "สรุป OT เดือนนี้ พร้อมค่าใช้จ่าย",
  "ปีนี้ใครลาเยอะสุด 5 อันดับ แยกประเภทลา",
];

interface Turn {
  role: "user" | "assistant";
  content: string;
  steps?: ChatStep[];
  proposals?: ProposalCard[];
  /** Files the assistant made for download. */
  outFiles?: OutFile[];
  /** Files attached to this question (user turns). */
  files?: { name: string; size: number }[];
  /** The question this answer replies to (assistant turns only). */
  question?: string;
}

/** Turns an answer into an Excel file (summary + the real report it read); shown under answers with data. */
function DownloadAnswer({ turn }: { turn: Turn }) {
  const [busy, setBusy] = useState(false);
  const hasData = !!turn.steps?.some((s) => s.report) || /^\s*\|.*\|\s*$/m.test(turn.content);
  if (!hasData) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { exportAnswerToExcel } = await import("./export-answer");
          const name = await exportAnswerToExcel(turn);
          toast.success(`ดาวน์โหลด ${name} แล้ว`);
        } catch {
          toast.error("สร้างไฟล์ไม่สำเร็จ ลองอีกครั้ง");
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:border-[#b9c2c9] disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="size-3.5 text-[#15803d]" aria-hidden="true" />}
      {busy ? "กำลังสร้างไฟล์…" : "ดาวน์โหลดสรุปเป็น Excel"}
    </button>
  );
}

/** The assistant's face: น้องวีบอท, the same on every message so the thread reads as a conversation. */
function BotAvatar({ className, mood = "ok" }: { className?: string; mood?: VBotMood }) {
  return <VBot mood={mood} className={cn("h-8 w-9", className)} />;
}

export function AiChatView({
  className = "h-[calc(100vh-20rem)] min-h-[24rem]",
  initialQuestion,
}: {
  className?: string;
  /** Asked once on mount (the dashboard's ask box links to `/ai?q=`). */
  initialQuestion?: string;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const chat = useChat();
  const attach = useAttachments();
  const access = useAiAccess();
  const engine = useEngineMode();
  const quick = useQuick();
  const [form, setForm] = useState<"announce" | "notify" | null>(null);
  const fallback = engine.mode === "fallback";
  // Reading files needs the AI, so the attach button waits for it to come back.
  const canAttach = access.data?.data.canAttach === true && !fallback;
  const scrollRef = useRef<HTMLDivElement>(null);
  const askedInitial = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialQuestion && !askedInitial.current) {
      askedInitial.current = true;
      submit(initialQuestion);
    }
    // Ask exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, chat.isPending]);

  /** A quick action: answered from our own data with no AI. Writes still come back as a confirmation card. */
  function runQuick(request: QuickRequest, label: string) {
    if (quick.isPending) return;
    setForm(null);
    setInput("");
    setTurns((prev) => [...prev, { role: "user", content: label }]);
    quick.mutate(request, {
      onSuccess: (res) => {
        const r = res.data;
        setTurns((prev) => [...prev, { role: "assistant", content: r.ok ? r.markdown : r.message, proposals: r.ok ? r.proposals : undefined, question: label }]);
        if (!r.ok && r.needs === "name") {
          setInput("โควตาวันลาของ ");
          inputRef.current?.focus();
        }
        playReplyChime();
      },
      onError: (err) => {
        const message = err instanceof ApiError && err.status < 500 && err.status !== 401 ? err.message : "เชื่อมต่อไม่ได้ ตรวจสัญญาณอินเทอร์เน็ต แล้วลองใหม่";
        setTurns((prev) => [...prev, { role: "assistant", content: message }]);
      },
    });
  }

  function pickName() {
    setInput("โควตาวันลาของ ");
    inputRef.current?.focus();
  }

  async function submit(text: string) {
    const hasFiles = canAttach && attach.files.length > 0;
    const trimmed = text.trim() || (hasFiles ? "ช่วยดูไฟล์ที่แนบ แล้วสรุปให้" : "");
    if (!trimmed || chat.isPending || quick.isPending) return;
    unlockReplyChime();

    // In the fallback, a short command we understand is answered here with no AI; anything else still goes to the chat,
    // which also lets the AI answer as soon as it is back.
    if (fallback && !hasFiles) {
      const cmd = parseQuickCommand(trimmed);
      if (cmd) {
        if (cmd.action === "announce" || cmd.action === "notify") {
          setForm(cmd.action);
          setInput("");
        } else {
          runQuick({ action: cmd.action, ...(cmd.name ? { name: cmd.name } : {}) }, trimmed);
        }
        return;
      }
    }
    const wasFallback = fallback;

    let attachments: Awaited<ReturnType<typeof attach.toPayload>> = [];
    if (hasFiles) {
      try {
        attachments = await attach.toPayload();
      } catch {
        toast.error("อ่านไฟล์ไม่ได้ ลองเลือกไฟล์ใหม่");
        return;
      }
    }
    const sentFiles = hasFiles ? attach.files.map((f) => ({ name: f.file.name, size: f.file.size })) : undefined;
    const before = turns;
    const nextTurns: Turn[] = [...turns, { role: "user", content: trimmed, files: sentFiles }];
    setTurns(nextTurns);
    setInput("");

    const history: ChatMessage[] = nextTurns.map((t) => ({ role: t.role, content: t.content }));
    chat.mutate({ messages: history, attachments }, {
      onSuccess: (res) => {
        if (hasFiles) attach.clear();
        engine.observe(res.data);
        // The same fallback twice in a row: the person has read why, so just say this question needs the AI.
        const reply = wasFallback && res.data.engine === "fallback" ? FALLBACK_NOT_UNDERSTOOD : res.data.reply;
        setTurns((prev) => [...prev, { role: "assistant", content: reply, steps: res.data.steps, proposals: res.data.proposals, outFiles: res.data.files, question: trimmed }]);
        playReplyChime();
      },
      onError: (err) => {
        // A refused file (too big, wrong kind, no permission) is the person's to fix: show why and give the message back.
        if (err instanceof ApiError && (err.status === 400 || err.status === 403 || err.status === 422)) {
          toast.error(err.message, { duration: 9000 });
          setTurns(before);
          setInput(text);
          return;
        }
        setTurns((prev) => [
          ...prev,
          { role: "assistant", content: "เชื่อมต่อน้องวีบอทไม่ได้ ตรวจสัญญาณอินเทอร์เน็ต แล้วลองถามใหม่" },
        ]);
        playReplyChime();
      },
    });
  }

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-muted/30 p-4" aria-live="polite">
        {fallback && <FallbackBanner reason={engine.reason} />}
        {turns.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            {fallback ? (
              <p className="text-base font-semibold text-foreground">เลือกปุ่มลัด หรือพิมพ์คำสั่งสั้น</p>
            ) : (
              <>
                <VBot mood="hi" full className="h-24 w-20" />
                <div>
                  <p className="text-base font-semibold text-foreground">สวัสดีครับ ผมน้องวีบอท</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    ดึงข้อมูลจริงจากระบบมาตอบ ช่วยสรุปข้อมูล ค้นเว็บ และส่งการแจ้งเตือนถึงพนักงานได้
                  </p>
                </div>
              </>
            )}
            {fallback ? (
              <QuickChips className="justify-center" onRun={runQuick} onPickName={pickName} onOpenForm={setForm} disabled={quick.isPending} />
            ) : (
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
            )}
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} className={cn("flex items-end gap-2", t.role === "user" && "justify-end")}>
            {t.role === "assistant" && <BotAvatar />}
            <div className={cn("max-w-[82%] min-w-0 space-y-1.5", t.role === "user" && "flex flex-col items-end")}>
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
                  "px-4 py-2.5 text-sm leading-relaxed break-words",
                  t.role === "user"
                    ? "rounded-2xl rounded-br-md bg-[var(--chat-teal)] whitespace-pre-wrap text-white"
                    : "min-w-0 rounded-2xl rounded-bl-md border border-border bg-card text-foreground shadow-sm",
                )}
              >
                {t.role === "assistant" ? <MarkdownLite text={t.content} /> : t.content}
                {t.role === "user" && <SentFiles files={t.files} />}
              </div>
              {t.role === "assistant" && <ProposalCards cards={t.proposals} />}
              {t.role === "assistant" && <FileDownloads files={t.outFiles} />}
              {t.role === "assistant" && <DownloadAnswer turn={t} />}
            </div>
          </div>
        ))}

        {quick.isPending && (
          <div className="flex items-end gap-2" role="status">
            <BotAvatar mood="think" />
            <div className="rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">กำลังดึงข้อมูลจากระบบ…</div>
          </div>
        )}

        {chat.isPending && (
          <div className="flex items-end gap-2" role="status">
            <BotAvatar mood="think" />
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
        {fallback && (
          <div className="mb-2 space-y-2">
            {form ? (
              <QuickForm key={form} kind={form} busy={quick.isPending} onSubmit={runQuick} onCancel={() => setForm(null)} />
            ) : (
              turns.length > 0 && <QuickChips onRun={runQuick} onPickName={pickName} onOpenForm={setForm} disabled={quick.isPending} className="flex-nowrap overflow-x-auto pb-1" />
            )}
          </div>
        )}
        {canAttach && <AttachTray files={attach.files} errors={attach.errors} onRemove={attach.remove} />}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(input);
          }}
          className="flex items-end gap-2 rounded-3xl border border-border bg-background p-1.5 pl-1.5 transition focus-within:border-[var(--chat-teal)] focus-within:ring-3 focus-within:ring-[var(--chat-teal)]/20"
        >
          {canAttach ? <AttachButton onPick={attach.add} disabled={chat.isPending} /> : <span className="w-2.5 shrink-0" aria-hidden="true" />}
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit(input);
              }
            }}
            aria-label="ข้อความถึง AI Assistant"
            placeholder={fallback ? "พิมพ์คำสั่งสั้น เช่น ใครมาสายวันนี้" : "ถามเรื่องพนักงาน เวลาทำงาน การลา…"}
            rows={1}
            className="max-h-32 min-h-11 flex-1 resize-none border-0 bg-transparent px-0 py-2.5 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <button
            type="submit"
            aria-label="ส่งข้อความ"
            disabled={chat.isPending || quick.isPending || (!input.trim() && !(canAttach && attach.files.length > 0))}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--chat-teal)] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            <ArrowUp className="size-5" />
          </button>
        </form>
        <p className="mt-1.5 hidden items-center gap-2 px-3 text-xs text-muted-foreground md:flex">
          <span>Enter เพื่อส่ง · Shift+Enter ขึ้นบรรทัดใหม่</span>
          <span className="ml-auto"><EngineBadge mode={engine.mode} /></span>
        </p>
      </div>
    </div>
  );
}
