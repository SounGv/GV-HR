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
  MessageSquare,
  Plus,
  RotateCcw,
  UsersRound,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { VBot } from "@/components/shared/v-bot";
import { cn } from "@/lib/utils";
import { useAiAccess, useChat, useQuick } from "./hooks";
import { EngineBadge, FallbackBanner, QuickChips, QuickForm, useEngineMode } from "./fallback-ui";
import { FALLBACK_NOT_UNDERSTOOD } from "./engine-state";
import { parseQuickCommand } from "./quick-actions";
import { ApiError } from "@/lib/api/client";
import { AttachButton, AttachTray, FileDownloads, SentFiles, useAttachments } from "./attachments-ui";
import { playReplyChime, unlockReplyChime } from "./reply-chime";
import { MarkdownLite } from "./markdown-lite";
import { arrowSelect } from "@/lib/arrow-select";
import { firstHeading, splitSummary, withoutFirstHeading } from "./reply-parts";
import { ProposalCards } from "./proposal-cards";
import { beginPointerDrag } from "./pointer-drag";
import type { ChatMessage, ChatStep, OutFile, ProposalCard, QuickRequest } from "./types";

/** Ready-made questions for the empty result panel, grouped by what HR asks most. */
const PROMPTS = [
  { icon: Clock, tone: "border-status-late-border bg-status-late-bg text-status-late-fg", q: "เดือนนี้ใครขาด ลา มาสายเยอะที่สุด", hint: "จัดอันดับจากรายงานการลงเวลา" },
  { icon: Check, tone: "border-blue-100 bg-blue-50 text-blue-800", q: "วันนี้ใครยังไม่สแกนเข้างาน", hint: "แยกตามแผนก" },
  { icon: CalendarDays, tone: "border-status-leave-border bg-status-leave-bg text-status-leave-fg", q: "สัปดาห์หน้าใครลาบ้าง", hint: "ดูก่อนจัดคนเข้ากะ" },
  { icon: Zap, tone: "border-violet-200 bg-violet-50 text-violet-700", q: "สรุปชั่วโมง OT เดือนนี้แยกแผนก", hint: "เฉพาะที่อนุมัติแล้ว" },
  { icon: LogOut, tone: "border-status-late-border bg-status-late-bg text-status-late-fg", q: "ใครลืมสแกนออกในสัปดาห์นี้", hint: "ให้ตามแก้เวลา" },
  { icon: UsersRound, tone: "border-slate-200 bg-slate-50 text-slate-700", q: "มีพนักงานทั้งหมดกี่คน แยกตามแผนก", hint: "รวมพนักงานรายวัน" },
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
  seconds?: number;
  failed?: boolean;
}

/**
 * How the workspace shares its width.
 * normal: result centred at a readable width. wide: result fills its panel and the chat column gets narrower.
 * full: the chat column folds into a slim rail so the result gets the whole workspace.
 */
type PanelWidth = "normal" | "wide" | "full";
const PANEL_WIDTHS: { id: PanelWidth; label: string; hint: string; className: string }[] = [
  { id: "normal", label: "ปกติ", hint: "ผลลัพธ์อยู่กลาง กว้างพอดีอ่าน", className: "max-w-[920px]" },
  { id: "wide", label: "กว้าง", hint: "ผลลัพธ์ใช้พื้นที่ทั้งแผง ช่องแชทแคบลง", className: "max-w-none" },
  { id: "full", label: "เต็มจอ", hint: "ซ่อนช่องแชท ให้ผลลัพธ์ใช้พื้นที่ทั้งหมด", className: "max-w-none" },
];
const PANEL_WIDTH_KEY = "gv-ai-panel-width";

/** The chosen width, remembered per browser. Read after mount so the server and client render the same first frame. */
function usePanelWidth(): [PanelWidth, (w: PanelWidth) => void] {
  const [width, setWidth] = useState<PanelWidth>("normal");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PANEL_WIDTH_KEY);
      if (saved === "normal" || saved === "wide" || saved === "full") setWidth(saved);
    } catch {
      // Storage can be blocked; the default width still works.
    }
  }, []);
  const choose = (w: PanelWidth) => {
    setWidth(w);
    try {
      window.localStorage.setItem(PANEL_WIDTH_KEY, w);
    } catch {
      // Not remembered, still applied for this visit.
    }
  };
  return [width, choose];
}

const CHAT_WIDTH_KEY = "gv-ai-chat-width";
const CHAT_MIN = 300;
/** Room the result panel always keeps, so the chat can be pulled wide but never swallow the answer. */
const RESULT_MIN = 360;
const CHAT_KEY_STEP = 24;

/** The chat column width the person dragged to (null = the preset widths), remembered per browser and read after mount. */
function useChatWidth(): [number | null, (w: number | null) => void] {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(CHAT_WIDTH_KEY));
      if (Number.isFinite(saved) && saved >= CHAT_MIN) setWidth(saved);
    } catch {
      // Storage can be blocked; the preset width still works.
    }
  }, []);
  const choose = (w: number | null) => {
    setWidth(w);
    try {
      if (w === null) window.localStorage.removeItem(CHAT_WIDTH_KEY);
      else window.localStorage.setItem(CHAT_WIDTH_KEY, String(w));
    } catch {
      // Not remembered, still applied for this visit.
    }
  };
  return [width, choose];
}

/** Three-way width switch for the result panel. */
function PanelWidthSwitch({ value, onChange }: { value: PanelWidth; onChange: (w: PanelWidth) => void }) {
  return (
    <div role="radiogroup" aria-label="ความกว้างของแผงผลลัพธ์" onKeyDown={arrowSelect} className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
      {PANEL_WIDTHS.map((w, wi) => (
        <button
          key={w.id}
          type="button"
          role="radio"
          aria-checked={value === w.id}
          tabIndex={value === w.id || (wi === 0 && !PANEL_WIDTHS.some((x) => x.id === value)) ? 0 : -1}
          title={w.hint}
          onClick={() => onChange(w.id)}
          className={cn(
            "h-7 rounded-lg px-2.5 text-[12.5px] font-medium whitespace-nowrap transition-colors",
            value === w.id ? "bg-[var(--flip7-teal-dark)] text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {w.label}
        </button>
      ))}
    </div>
  );
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
 * @param initialQuestion Put in the input box on load (from the dashboard's ask box, `/ai?q=`); the person presses send.
 */
export function AiWorkspace({ initialQuestion }: { initialQuestion?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [panelWidth, setPanelWidth] = usePanelWidth();
  const [chatWidth, setChatWidth] = useChatWidth();
  const gridRef = useRef<HTMLDivElement>(null);
  const chatSectionRef = useRef<HTMLElement>(null);
  const chat = useChat();
  const attach = useAttachments();
  const access = useAiAccess();
  const engine = useEngineMode();
  const quick = useQuick();
  const [form, setForm] = useState<"announce" | "notify" | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const fallback = engine.mode === "fallback";
  const clearFiles = attach.clear;
  useEffect(() => {
    if (fallback) clearFiles();
  }, [fallback, clearFiles]);
  // Reading files needs the AI, so the attach button waits for it to come back.
  const canAttach = access.data?.data.canAttach === true && !fallback;
  const elapsed = useElapsed(chat.isPending);
  const scrollRef = useRef<HTMLDivElement>(null);
  const askedInitial = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, chat.isPending]);

  /** A quick action: answered from our own data with no AI. Writes still come back as a confirmation card. */
  function runQuick(request: QuickRequest, label: string) {
    if (quick.isPending) return;
    setForm(null);
    setInput("");
    const next: Turn[] = [...turns.filter((t) => !t.failed), { role: "user", content: label }];
    setTurns(next);
    quick.mutate(request, {
      onSuccess: (res) => {
        const r = res.data;
        setTurns((prev) => [...prev, { role: "assistant", content: r.ok ? r.markdown : r.message, proposals: r.ok ? r.proposals : undefined, question: label }]);
        setSelected(next.length);
        if (!r.ok && r.needs === "name") {
          setInput("โควตาวันลาของ ");
          inputRef.current?.focus();
        }
        playReplyChime();
      },
      onError: (err) => {
        const message = err instanceof ApiError && err.status < 500 && err.status !== 401 ? err.message : "เชื่อมต่อไม่ได้ ตรวจสัญญาณอินเทอร์เน็ต แล้วลองใหม่";
        setTurns((prev) => [...prev, { role: "assistant", content: message, question: label }]);
      },
    });
  }

  function pickName() {
    setInput("โควตาวันลาของ ");
    inputRef.current?.focus();
  }

  async function submit(text: string, history: Turn[] = turns) {
    const hasFiles = canAttach && attach.files.length > 0;
    const q = text.trim() || (hasFiles ? "ช่วยดูไฟล์ที่แนบ แล้วสรุปให้" : "");
    if (!q || chat.isPending || quick.isPending) return;
    unlockReplyChime();

    // In the fallback, a short command we understand is answered here with no AI; anything else still goes to the chat,
    // which also lets the AI answer as soon as it is back.
    if (fallback && !hasFiles) {
      const cmd = parseQuickCommand(q);
      if (cmd) {
        if (cmd.action === "announce" || cmd.action === "notify") {
          setFormTitle(cmd.title ?? "");
          setForm(cmd.action);
          setInput("");
        } else {
          runQuick({ action: cmd.action, ...(cmd.name ? { name: cmd.name } : {}), ...(cmd.count ? { count: cmd.count } : {}) }, q);
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
    const next: Turn[] = [...history, { role: "user", content: q, files: sentFiles }];
    setTurns(next);
    setInput("");
    const started = Date.now();
    const messages: ChatMessage[] = next.filter((t) => !t.failed).map((t) => ({ role: t.role, content: t.content }));
    chat.mutate({ messages, attachments }, {
      onSuccess: (res) => {
        if (hasFiles) attach.clear();
        engine.observe(res.data);
        // The same fallback twice in a row: the person has read why, so just say this question needs the AI.
        const reply = wasFallback && res.data.engine === "fallback" && !res.data.backup ? FALLBACK_NOT_UNDERSTOOD : res.data.reply;
        // The answer lands right after the question we just added, at index next.length.
        setTurns((prev) => [
          ...prev,
          { role: "assistant", content: reply, steps: res.data.steps, proposals: res.data.proposals, outFiles: res.data.files, question: q, seconds: Math.round((Date.now() - started) / 1000) },
        ]);
        setSelected(next.length);
        playReplyChime();
      },
      onError: (err) => {
        // A refused file (too big, wrong kind, no permission) is the person's to fix: show why and give the message back.
        if (err instanceof ApiError && (err.status === 400 || err.status === 403 || err.status === 422)) {
          toast.error(err.message, { duration: 9000 });
          setTurns(history);
          setInput(text);
          return;
        }
        setTurns((prev) => [...prev, { role: "assistant", content: "", question: q, failed: true }]);
        playReplyChime();
      },
    });
  }

  useEffect(() => {
    // A link (`/ai?q=`) only fills the box: a question runs, and counts, when the person presses send.
    if (initialQuestion && !askedInitial.current) {
      askedInitial.current = true;
      setInput(initialQuestion);
      inputRef.current?.focus();
    }
    // Once, on mount.
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

  // The chat folds away only while there is an answer to look at; with nothing selected the person still needs the input.
  const chatFolded = panelWidth === "full" && answer !== null;
  const widthClass = PANEL_WIDTHS.find((w) => w.id === panelWidth)?.className;

  return (
    <div
      ref={gridRef}
      style={!chatFolded && chatWidth !== null ? { gridTemplateColumns: `${chatWidth}px minmax(0,1fr)` } : undefined}
      className={cn(
        "grid h-[calc(100dvh-8.5rem)] min-h-[560px] overflow-hidden rounded-lg border border-border bg-card shadow-[var(--card-shadow)]",
        chatFolded
          ? "grid-cols-[56px_minmax(0,1fr)]"
          : chatWidth !== null
            ? ""
            : panelWidth === "wide"
              ? "grid-cols-[minmax(300px,340px)_minmax(0,1fr)]"
              : "grid-cols-[minmax(340px,420px)_minmax(0,1fr)]",
      )}
    >
      {chatFolded && (
        <div className="flex flex-col items-center gap-2 border-r border-border py-3">
          <button
            type="button"
            onClick={() => setPanelWidth("wide")}
            aria-label="เปิดช่องแชท"
            title="เปิดช่องแชท เพื่อถามต่อ"
            className="flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <MessageSquare className="size-[18px]" aria-hidden="true" />
          </button>
          {(chat.isPending || quick.isPending) && (
            <Loader2 className="size-4 animate-spin text-muted-foreground motion-reduce:animate-[spin_2.5s_linear_infinite]" role="status" aria-label="กำลังดึงข้อมูล" />
          )}
        </div>
      )}
      {/* Left: the conversation (kept mounted when folded, so a half-typed question is not lost) */}
      <section ref={chatSectionRef} aria-label="แชทกับ AI Assistant" className={cn("relative flex min-h-0 flex-col border-r border-border", chatFolded && "hidden")}>
        {/* Drag this edge to make the chat column wider or narrower; arrow keys also work and double click puts it back. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="ปรับความกว้างของช่องแชท"
          aria-valuemin={CHAT_MIN}
          aria-valuenow={chatWidth ?? undefined}
          tabIndex={0}
          title="ลากเพื่อปรับความกว้างช่องแชท ดับเบิลคลิกเพื่อคืนขนาดเดิม"
          onPointerDown={(e) => {
            const startW = chatSectionRef.current?.getBoundingClientRect().width ?? CHAT_MIN;
            const maxW = Math.max(CHAT_MIN, (gridRef.current?.getBoundingClientRect().width ?? 1200) - RESULT_MIN);
            let next = startW;
            beginPointerDrag(
              e,
              "ew-resize",
              (dx) => {
                next = Math.round(Math.min(Math.max(startW + dx, CHAT_MIN), maxW));
                if (gridRef.current) gridRef.current.style.gridTemplateColumns = `${next}px minmax(0,1fr)`;
              },
              () => setChatWidth(next),
            );
          }}
          onDoubleClick={() => setChatWidth(null)}
          onKeyDown={(e) => {
            const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
            if (e.key === "Home") {
              e.preventDefault();
              setChatWidth(null);
              return;
            }
            if (dir === 0) return;
            e.preventDefault();
            const cur = chatSectionRef.current?.getBoundingClientRect().width ?? CHAT_MIN;
            const maxW = Math.max(CHAT_MIN, (gridRef.current?.getBoundingClientRect().width ?? 1200) - RESULT_MIN);
            setChatWidth(Math.round(Math.min(Math.max(cur + dir * CHAT_KEY_STEP, CHAT_MIN), maxW)));
          }}
          className="group absolute inset-y-0 -right-1 z-10 w-2.5 cursor-ew-resize touch-none outline-none focus-visible:bg-ring/30"
        >
          <span className="absolute top-1/2 left-1 h-14 w-1 -translate-y-1/2 rounded-full bg-muted-foreground/40 transition-colors group-hover:bg-primary group-focus-visible:bg-primary" aria-hidden="true" />
        </div>
        <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <VBot mood={chat.isPending ? "think" : "ok"} className="h-8 w-9" />
          <div className="min-w-0">
            <h2 className="text-[14.5px] leading-snug font-semibold">AI Assistant</h2>
            <p className="text-xs text-muted-foreground">ตอบจากข้อมูลจริงในระบบ · ผลลัพธ์แสดงที่แผงขวา</p>
          </div>
          <button
            type="button"
            onClick={newChat}
            disabled={chat.isPending || turns.length === 0}
            className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12.5px] font-medium whitespace-nowrap transition-colors hover:border-[#b9c2c9] disabled:opacity-50"
          >
            <Plus className="size-3.5" aria-hidden="true" /> แชทใหม่
          </button>
        </header>

        <div className="flex items-center gap-2 border-b border-border px-4 py-1.5">
          <EngineBadge mode={engine.mode} />
          {access.data?.data.canManage && (
            <Link href="/ai/settings" className="ml-auto inline-flex min-h-11 items-center text-xs text-muted-foreground underline md:min-h-8 underline-offset-2 hover:text-foreground">
              ตั้งค่า
            </Link>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3.5 overflow-y-auto p-4" aria-live="polite">
          {fallback && <FallbackBanner reason={engine.reason} backup={engine.backup} />}
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
                className="ml-auto w-fit max-w-[85%] rounded-[16px_16px_4px_16px] bg-[var(--flip7-teal-dark)] px-3.5 py-2 text-[13.5px] break-words text-white shadow-sm"
              >
                {t.content}
                <SentFiles files={t.files} />
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

          {quick.isPending && (
            <div className="flex items-start gap-2" role="status">
              <VBot mood="think" className="h-7 w-8" />
              <p className="rounded-[4px_14px_14px_14px] border border-border bg-card px-3 py-2 text-[13px] text-muted-foreground shadow-[var(--card-shadow)]">กำลังดึงข้อมูลจากระบบ…</p>
            </div>
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
            void submit(input);
          }}
          className="border-t border-border p-3"
        >
          {fallback && (
            <div className="mb-2 space-y-2">
              {turns.length > 0 &&
                (form ? (
                  <QuickForm key={form} kind={form} initialTitle={formTitle} busy={quick.isPending} onSubmit={runQuick} onCancel={() => setForm(null)} />
                ) : (
                  <QuickChips onRun={runQuick} onPickName={pickName} onOpenForm={(k) => { setFormTitle(""); setForm(k); }} disabled={quick.isPending} className="flex-nowrap overflow-x-auto pb-1" />
                ))}
            </div>
          )}
          {canAttach && <AttachTray files={attach.files} errors={attach.errors} onRemove={attach.remove} />}
          <div className="flex items-end gap-1.5 rounded-lg border-[1.5px] border-[#cfd6dc] bg-card py-1.5 pr-1.5 pl-1.5 transition focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15 dark:border-border">
            {canAttach ? <AttachButton onPick={attach.add} disabled={chat.isPending} className="size-9" /> : <span className="w-1.5 shrink-0" aria-hidden="true" />}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void submit(input);
                }
              }}
              rows={1}
              maxLength={2000}
              aria-label="พิมพ์คำถามถึง AI Assistant"
              placeholder={fallback ? "พิมพ์คำสั่งสั้น เช่น ใครมาสายวันนี้" : "ถามเรื่องทีม เช่น ใครมาสายเกิน 3 ครั้งเดือนนี้"}
              className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              aria-label="ส่งคำถาม"
              disabled={chat.isPending || quick.isPending || (!input.trim() && !(canAttach && attach.files.length > 0))}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--flip7-teal-dark)] text-white transition-colors hover:bg-[#0d47a1] disabled:bg-muted disabled:text-muted-foreground"
            >
              <ArrowUp className="size-4" strokeWidth={2.4} />
            </button>
          </div>
          <p className="mt-1.5 px-1 text-xs text-muted-foreground">Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่ · ตัวเลขที่ใช้จ่ายเงินให้ยืนยันจากรายงานก่อน</p>
        </form>
      </section>

      {/* Right: the selected answer, laid out wide */}
      <section aria-label="ผลลัพธ์" className="min-w-0 overflow-y-auto bg-[#eef3f3] px-6 py-5 dark:bg-none">
        <div className="mb-3 flex justify-end">
          <PanelWidthSwitch value={panelWidth} onChange={(w) => { setChatWidth(null); setPanelWidth(w); }} />
        </div>
        {answer && answerParts ? (
          <article className={cn("mx-auto space-y-3", widthClass)}>
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
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#cfd6dc] bg-card px-3 text-[13px] font-medium transition-colors hover:border-[#b9c2c9] dark:border-border"
              >
                {copied ? <Check className="size-4 text-success" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                {copied ? "คัดลอกแล้ว" : "คัดลอก"}
              </button>
              <button
                type="button"
                onClick={downloadExcel}
                disabled={exporting}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#cfd6dc] bg-card px-3 text-[13px] font-medium transition-colors hover:border-[#b9c2c9] disabled:opacity-60 dark:border-border"
              >
                {exporting ? <Loader2 className="size-4 animate-spin motion-reduce:animate-[spin_2.5s_linear_infinite]" aria-hidden="true" /> : <FileSpreadsheet className="size-4 text-[#15803d]" aria-hidden="true" />}
                {exporting ? "กำลังสร้างไฟล์…" : "ดาวน์โหลด Excel"}
              </button>
              {reportStep?.report && (
                <Link
                  href={`/reports?view=${encodeURIComponent(reportStep.report.type)}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--flip7-teal-dark)] px-3.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#0d47a1]"
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
                      <Globe className="size-3 shrink-0 text-primary" aria-hidden="true" />
                    ) : (
                      <Database className="size-3 shrink-0 text-primary" aria-hidden="true" />
                    )}
                    <span className="truncate">{s.detail}</span>
                  </li>
                ))}
              </ul>
            )}

            <ProposalCards cards={answer.proposals} />
            <FileDownloads files={answer.outFiles} />

            {answerParts.summary && answerParts.rest && (
              <MarkdownLite
                text={answerParts.summary}
                className="rounded-lg border border-blue-100 bg-blue-50/70 px-3.5 py-2.5 text-[13.5px] text-foreground dark:border-border dark:bg-muted"
              />
            )}

            <div className="rounded-lg border border-border bg-card p-4 shadow-[var(--card-shadow)]">
              <MarkdownLite text={panelBody} />
            </div>
          </article>
        ) : chat.isPending ? (
          <div className="grid h-[calc(100%-2.875rem)] place-items-center text-center" role="status">
            <div>
              <VBot mood="think" full className="mx-auto h-[118px] w-[100px]" />
              <p className="mt-2 text-base font-semibold">กำลังหาคำตอบ</p>
              <p className="text-sm text-muted-foreground tabular-nums">ผ่านไป {elapsed} วินาที</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex min-h-[calc(100%-2.875rem)] max-w-[760px] flex-col justify-center py-4">
            <div className="text-center">
              <VBot mood="hi" full className="mx-auto h-[122px] w-[104px]" />
              <h2 className="mt-2 text-[22px] leading-snug font-bold">วันนี้อยากรู้อะไรเรื่องทีม</h2>
              <p className="text-sm text-muted-foreground">เลือกคำถามด้านล่าง หรือพิมพ์ทางซ้าย ผมจะดึงข้อมูลจริงมาจัดเป็นตารางให้ที่นี่</p>
            </div>
            {fallback ? (
              <div className="mt-5 space-y-3">
                {turns.length > 0 ? (
                  <p className="text-center text-sm text-muted-foreground">กดคำตอบทางซ้ายเพื่อดูรายละเอียดที่นี่ หรือใช้ปุ่มลัดใต้ช่องพิมพ์</p>
                ) : form ? (
                  <QuickForm key={form} kind={form} initialTitle={formTitle} busy={quick.isPending} onSubmit={runQuick} onCancel={() => setForm(null)} />
                ) : (
                  <QuickChips className="justify-center" onRun={runQuick} onPickName={pickName} onOpenForm={(k) => { setFormTitle(""); setForm(k); }} disabled={quick.isPending} />
                )}
              </div>
            ) : (
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {PROMPTS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.q}
                    type="button"
                    onClick={() => submit(p.q)}
                    className="gv-lift flex items-start gap-3 rounded-lg border border-border bg-card px-3.5 py-3 text-left shadow-[var(--card-shadow)] hover:border-[#b9c2c9]"
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
            )}
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
              "mt-1.5 flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[12.5px] font-semibold transition-colors",
              active
                ? "border-blue-200 bg-blue-50 text-primary dark:border-border dark:bg-muted"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Database className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{firstHeading(turn.content) ?? "ดูรายละเอียด"}</span>
            <span className="ml-auto shrink-0 text-xs font-medium">{active ? "แสดงอยู่ทางขวา" : "ดูทางขวา"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
