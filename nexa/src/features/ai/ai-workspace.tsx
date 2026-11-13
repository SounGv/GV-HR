"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  CalendarDays,
  Check,
  Clock,
  Copy,
  Database,
  ExternalLink,
  Globe,
  FileSpreadsheet,
  Loader2,
  LogOut,
  Plus,
  RotateCcw,
  UsersRound,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { VBot } from "@/components/shared/v-bot";
import { cn } from "@/lib/utils";
import { useChat } from "./hooks";
import { playReplyChime, unlockReplyChime } from "./reply-chime";
import { MarkdownLite } from "./markdown-lite";
import { firstHeading, splitSummary, withoutFirstHeading } from "./reply-parts";
import type { ChatMessage, ChatStep } from "./types";

/** Ready-made questions for the empty result panel, grouped by what HR asks most. */
const PROMPTS = [
  { icon: Clock, tone: "border-status-late-border bg-status-late-bg text-status-late-fg", q: "เดือนนี้ใครขาด ลา มาสายเยอะที่สุด", hint: "จัดอันดับจากรายงานการลงเวลา" },
  { icon: Check, tone: "border-teal-100 bg-teal-50 text-teal-700", q: "วันนี้ใครยังไม่สแกนเข้างาน", hint: "แยกตามแผนก" },
  { icon: CalendarDays, tone: "border-status-leave-border bg-status-leave-bg text-status-leave-fg", q: "สัปดาห์หน้าใครลาบ้าง", hint: "ดูก่อนจัดคนเข้ากะ" },
  { icon: Zap, tone: "border-violet-200 bg-violet-50 text-violet-700", q: "สรุปชั่วโมง OT เดือนนี้แยกแผนก", hint: "เฉพาะที่อนุมัติแล้ว" },
  { icon: LogOut, tone: "border-status-late-border bg-status-late-bg text-status-late-fg", q: "ใครลืมสแกนออกในสัปดาห์นี้", hint: "ให้ตามแก้เวลา" },
  { icon: UsersRound, tone: "border-slate-200 bg-slate-50 text-slate-700", q: "มีพนักงานทั้งหมดกี่คน แยกตามแผนก", hint: "รวมพนักงานรายวัน" },
];

interface Turn {
  role: "user" | "assistant";
  content: string;
  steps?: ChatStep[];
  /** The question this answer replies to (assistant turns only). */
  question?: string;
  seconds?: number;
  failed?: boolean;
}

/** Ticks once a second while `running`, so the wait shows progress instead of looking frozen. */
function useElapsed(running: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    setSeconds(0);
    const started = Date.now();
    const t = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [running]);
  return seconds;
}

/**
 * Desktop AI Assistant: chat on the left, the selected answer laid out on a
 * wide result panel on the right (tables and numbers need the width; a chat
 * bubble squeezes them).
 *
 * @param initialQuestion Asked once on load (from the dashboard's ask box, `/ai?q=`).
 */
export function AiWorkspace({ initialQuestion }: { initialQuestion?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const chat = useChat();
  const elapsed = useElapsed(chat.isPending);
  const scrollRef = useRef<HTMLDivElement>(null);
  const askedInitial = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, chat.isPending]);

  function submit(text: string, history: Turn[] = turns) {
    const q = text.trim();
    if (!q || chat.isPending) return;
    unlockReplyChime();
    const next: Turn[] = [...history, { role: "user", content: q }];
    setTurns(next);
    setInput("");
    const started = Date.now();
    const messages: ChatMessage[] = next.filter((t) => !t.failed).map((t) => ({ role: t.role, content: t.content }));
    chat.mutate(messages, {
      onSuccess: (res) => {
        // The answer lands right after the question we just added, at index next.length.
        setTurns((prev) => [
          ...prev,
          { role: "assistant", content: res.data.reply, steps: res.data.steps, question: q, seconds: Math.round((Date.now() - started) / 1000) },
        ]);
        setSelected(next.length);
        playReplyChime();
      },
      onError: () => {
        setTurns((prev) => [...prev, { role: "assistant", content: "", question: q, failed: true }]);
        playReplyChime();
      },
    });
  }

  useEffect(() => {
    if (initialQuestion && !askedInitial.current) {
      askedInitial.current = true;
      submit(initialQuestion, []);
    }
    // Ask exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function retry(index: number) {
    const failed = turns[index];
    if (!failed?.question) return;
    // Drop the failed answer and its question, then ask again from the same history.
    submit(failed.question, turns.slice(0, index - 1));
  }

  function newChat() {
    setTurns([]);
    setSelected(null);
    setInput("");
  }

  const answer = selected !== null ? turns[selected] : null;
  const answerParts = answer && !answer.failed ? splitSummary(answer.content) : null;
  const panelTitle = answer ? (firstHeading(answer.content) ?? answer.question) : "";
  // The first heading is already the panel title; don't print it twice.
  const panelBody = answerParts ? withoutFirstHeading(answerParts.rest || answer!.content) : "";
  const reportStep = answer?.steps?.find((s) => s.report);

  async function downloadExcel() {
    if (!answer || exporting) return;
    setExporting(true);
    try {
      const { exportAnswerToExcel } = await import("./export-answer");
      const name = await exportAnswerToExcel(answer);
      toast.success(`ดาวน์โหลด ${name} แล้ว`);
    } catch {
      toast.error("สร้างไฟล์ไม่สำเร็จ ลองอีกครั้ง หรือเปิดรายงานเต็มแล้วส่งออกจากหน้ารายงาน");
    } finally {
      setExporting(false);
    }
  }

  async function copyAnswer() {
    if (!answer) return;
    try {
      await navigator.clipboard.writeText(answer.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked (permissions/insecure context); the text is still on screen to select.
    }
  }

  return (
    <div className="grid h-[calc(100dvh-8.5rem)] min-h-[560px] grid-cols-[minmax(340px,420px)_minmax(0,1fr)] overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--card-shadow)]">
      {/* Left: the conversation */}
      <section aria-label="แชทกับ AI Assistant" className="flex min-h-0 flex-col border-r border-border">
        <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <VBot mood={chat.isPending ? "think" : "ok"} className="h-8 w-9" />
          <div className="min-w-0">
            <h1 className="text-[14.5px] leading-tight font-semibold">AI Assistant</h1>
            <p className="text-xs text-muted-foreground">ตอบจากข้อมูลจริงในระบบ · ผลลัพธ์แสดงที่แผงขวา</p>
          </div>
          <button
            type="button"
            onClick={newChat}
            disabled={chat.isPending || turns.length === 0}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-border px-2.5 text-[12.5px] font-medium transition-colors hover:border-[#b9c2c9] disabled:opacity-50"
          >
            <Plus className="size-3.5" aria-hidden="true" /> แชทใหม่
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-3.5 overflow-y-auto p-4" aria-live="polite">
          <div className="flex items-start gap-2">
            <VBot mood="hi" className="h-7 w-8" />
            <p className="rounded-[4px_14px_14px_14px] border border-border bg-card px-3 py-2 text-[13.5px] shadow-[var(--card-shadow)]">
              สวัสดีครับ ผมน้องวีบอท ถามเรื่องการเข้างาน การลา OT หรือพนักงานได้เลย ตัวเลขและตารางจะขึ้นที่แผงขวา
            </p>
          </div>

          {turns.map((t, i) =>
            t.role === "user" ? (
              <p
                key={i}
                className="ml-auto w-fit max-w-[85%] rounded-[16px_16px_4px_16px] bg-[var(--flip7-teal-dark)] px-3.5 py-2 text-[13.5px] break-words text-white shadow-[0_1px_2px_rgba(15,118,110,.2),0_6px_14px_-8px_rgba(15,118,110,.5)]"
              >
                {t.content}
              </p>
            ) : t.failed ? (
              <div key={i} className="flex items-start gap-2" role="alert">
                <VBot mood="sorry" className="h-7 w-8" />
                <div className="rounded-[4px_14px_14px_14px] border border-status-absent-border bg-status-absent-bg px-3 py-2 text-[13px] text-status-absent-fg">
                  <p className="font-semibold">ตอบไม่สำเร็จ การเชื่อมต่อหลุดระหว่างดึงข้อมูล</p>
                  <p>คำถามยังอยู่ กดลองอีกครั้งได้เลย</p>
                  <button
                    type="button"
                    onClick={() => retry(i)}
                    disabled={chat.isPending}
                    className="mt-1.5 inline-flex h-7 items-center gap-1.5 rounded-lg border border-status-absent-border bg-card px-2.5 text-xs font-semibold"
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" /> ลองอีกครั้ง
                  </button>
                </div>
              </div>
            ) : (
              <AnswerBubble key={i} turn={t} active={selected === i} onShow={() => setSelected(i)} />
            ),
          )}

          {chat.isPending && (
            <div className="flex items-start gap-2" role="status">
              <VBot mood="think" className="h-7 w-8" />
              <div className="rounded-[4px_14px_14px_14px] border border-border bg-card px-3 py-2 text-[13px] shadow-[var(--card-shadow)]">
                <p className="font-medium">กำลังดึงข้อมูลจากระบบ…</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  ผ่านไป {elapsed} วินาที · คำถามที่ต้องดึงรายงานใช้เวลาประมาณ 20–40 วินาที
                </p>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="border-t border-border p-3"
        >
          <div className="flex items-end gap-1.5 rounded-[14px] border-[1.5px] border-[#cfd6dc] bg-card py-1.5 pr-1.5 pl-3 transition focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15 dark:border-border">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit(input);
                }
              }}
              rows={1}
              maxLength={2000}
              aria-label="พิมพ์คำถามถึง AI Assistant"
              placeholder="ถามเรื่องทีม เช่น ใครมาสายเกิน 3 ครั้งเดือนนี้"
              className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              aria-label="ส่งคำถาม"
              disabled={chat.isPending || !input.trim()}
              className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--flip7-teal-dark)] text-white transition-colors hover:bg-[#115e59] disabled:bg-muted disabled:text-muted-foreground"
            >
              <ArrowUp className="size-4" strokeWidth={2.4} />
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[11.5px] text-muted-foreground">Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่ · ตัวเลขที่ใช้จ่ายเงินให้ยืนยันจากรายงานก่อน</p>
        </form>
      </section>

      {/* Right: the selected answer, laid out wide */}
      <section aria-label="ผลลัพธ์" className="min-w-0 overflow-y-auto bg-[linear-gradient(180deg,#eef3f3_0,var(--background)_220px)] px-6 py-5 dark:bg-none">
        {answer && answerParts ? (
          <article className="mx-auto max-w-[920px] space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl leading-snug font-bold">{panelTitle}</h2>
                <p className="text-[12.5px] text-muted-foreground">
                  คำถาม: {answer.question}
                  {answer.seconds !== undefined && <> · ตอบใน {answer.seconds} วินาที</>}
                </p>
              </div>
              <button
                type="button"
                onClick={copyAnswer}
                className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[#cfd6dc] bg-card px-3 text-[13px] font-medium transition-colors hover:border-[#b9c2c9] dark:border-border"
              >
                {copied ? <Check className="size-4 text-success" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                {copied ? "คัดลอกแล้ว" : "คัดลอก"}
              </button>
              <button
                type="button"
                onClick={downloadExcel}
                disabled={exporting}
                className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[#cfd6dc] bg-card px-3 text-[13px] font-medium transition-colors hover:border-[#b9c2c9] disabled:opacity-60 dark:border-border"
              >
                {exporting ? <Loader2 className="size-4 animate-spin motion-reduce:animate-[spin_2.5s_linear_infinite]" aria-hidden="true" /> : <FileSpreadsheet className="size-4 text-[#15803d]" aria-hidden="true" />}
                {exporting ? "กำลังสร้างไฟล์…" : "ดาวน์โหลด Excel"}
              </button>
              {reportStep?.report && (
                <Link
                  href={`/reports?view=${encodeURIComponent(reportStep.report.type)}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[var(--flip7-teal-dark)] px-3.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(15,118,110,.2),0_6px_14px_-8px_rgba(15,118,110,.5)] transition-colors hover:bg-[#115e59]"
                >
                  เปิดรายงานเต็ม <ExternalLink className="size-3.5" aria-hidden="true" />
                </Link>
              )}
            </div>

            {answer.steps && answer.steps.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="ข้อมูลที่ใช้ตอบ">
                {answer.steps.map((s, si) => (
                  <li
                    key={si}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {s.tool === "web_search" ? (
                      <Globe className="size-3 shrink-0 text-[var(--flip7-teal-dark)]" aria-hidden="true" />
                    ) : (
                      <Database className="size-3 shrink-0 text-[var(--flip7-teal-dark)]" aria-hidden="true" />
                    )}
                    <span className="truncate">{s.detail}</span>
                  </li>
                ))}
              </ul>
            )}

            {answerParts.summary && answerParts.rest && (
              <MarkdownLite
                text={answerParts.summary}
                className="rounded-xl border border-teal-100 bg-teal-50/70 px-3.5 py-2.5 text-[13.5px] text-foreground dark:border-border dark:bg-muted"
              />
            )}

            <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--card-shadow)]">
              <MarkdownLite text={panelBody} />
            </div>
          </article>
        ) : chat.isPending ? (
          <div className="grid h-full place-items-center text-center" role="status">
            <div>
              <VBot mood="think" full className="mx-auto h-[118px] w-[100px]" />
              <p className="mt-2 text-base font-semibold">กำลังหาคำตอบ</p>
              <p className="text-sm text-muted-foreground tabular-nums">ผ่านไป {elapsed} วินาที</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex min-h-full max-w-[760px] flex-col justify-center py-4">
            <div className="text-center">
              <VBot mood="hi" full className="mx-auto h-[122px] w-[104px]" />
              <h2 className="mt-2 text-[22px] leading-snug font-bold">วันนี้อยากรู้อะไรเรื่องทีม</h2>
              <p className="text-sm text-muted-foreground">เลือกคำถามด้านล่าง หรือพิมพ์ทางซ้าย ผมจะดึงข้อมูลจริงมาจัดเป็นตารางให้ที่นี่</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {PROMPTS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.q}
                    type="button"
                    onClick={() => submit(p.q)}
                    className="gv-lift flex items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left shadow-[var(--card-shadow)] hover:border-[#b9c2c9]"
                  >
                    <span className={cn("flex size-[30px] shrink-0 items-center justify-center rounded-lg border", p.tone)}>
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-[13.5px] leading-snug font-semibold">{p.q}</span>
                      <span className="block text-xs text-muted-foreground">{p.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/** Assistant reply in the chat column: the short summary, with a button that shows the full answer on the right. */
function AnswerBubble({ turn, active, onShow }: { turn: Turn; active: boolean; onShow: () => void }) {
  const { summary, rest } = splitSummary(turn.content);
  const hasDetail = rest.length > 0;
  return (
    <div className="flex items-start gap-2">
      <VBot mood="ok" className="h-7 w-8" />
      <div className="min-w-0 rounded-[4px_14px_14px_14px] border border-border bg-card px-3 py-2 text-[13.5px] shadow-[var(--card-shadow)]">
        {summary ? <MarkdownLite text={summary} className="text-[13.5px]" /> : !hasDetail && <MarkdownLite text={turn.content} />}
        {hasDetail && (
          <button
            type="button"
            onClick={onShow}
            aria-pressed={active}
            className={cn(
              "mt-1.5 flex w-full items-center gap-2 rounded-[10px] border px-2.5 py-1.5 text-left text-[12.5px] font-semibold transition-colors",
              active
                ? "border-teal-200 bg-teal-50 text-[var(--flip7-teal-dark)] dark:border-border dark:bg-muted"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Database className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{firstHeading(turn.content) ?? "ดูรายละเอียด"}</span>
            <span className="ml-auto shrink-0 text-[11.5px] font-normal">{active ? "แสดงอยู่ทางขวา" : "ดูทางขวา"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
