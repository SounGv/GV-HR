"use client";

import { useState } from "react";
import { Bell, CalendarDays, ChartNoAxesColumn, CheckCircle2, ClipboardList, Clock, Loader2, Megaphone, ShieldCheck, TriangleAlert, UsersRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { QUICK_ACTIONS, type QuickAction } from "./quick-actions";
import { useAiAccess } from "./hooks";
import type { ChatResponse, QuickRequest } from "./types";

/**
 * The fallback ("โหมดสำรอง") of น้องวีบอท: when the AI service is down or this month's cap is used up, the quick
 * actions answer from our own data with no AI. This file has the pieces both chat screens share.
 */

type Reason = "credit" | "key" | "cap";

/**
 * Who answers now. It starts from what the server said when the page loaded, and every chat answer after that can
 * change it (the AI went down, or came back), so the screen follows without a reload.
 */
export function useEngineMode() {
  const access = useAiAccess();
  const [override, setOverride] = useState<{ mode: "ai" | "fallback"; reason?: Reason } | null>(null);
  const base = access.data?.data.engine;
  const mode = override?.mode ?? base?.mode ?? "ai";
  const reason = override ? override.reason : base?.reason;
  return {
    mode,
    reason,
    /** Call with every chat answer. */
    observe(res: Pick<ChatResponse, "engine" | "fallbackReason">) {
      if (res.engine === "fallback") setOverride({ mode: "fallback", reason: res.fallbackReason });
      else if (res.engine === "ai") setOverride({ mode: "ai" });
    },
  };
}

const ICONS = { clock: Clock, users: UsersRound, clip: ClipboardList, cal: CalendarDays, chart: ChartNoAxesColumn, mega: Megaphone, bell: Bell } as const;

const REASON_TEXT: Record<Reason, string> = {
  credit: "AI หลักใช้ไม่ได้ชั่วคราว (เครดิตหมด)",
  key: "AI หลักเชื่อมต่อไม่ได้ชั่วคราว",
  cap: "ใช้ AI ครบเพดานของเดือนนี้แล้ว",
};

/** The small status pill: AI normal, or fallback. Icon plus words, never colour alone. */
export function EngineBadge({ mode }: { mode: "ai" | "fallback" }) {
  return mode === "ai" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs whitespace-nowrap font-medium text-accent-foreground">
      <CheckCircle2 className="size-3.5" aria-hidden="true" /> AI พร้อมใช้
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-status-late-border bg-status-late-bg px-2 py-0.5 text-xs whitespace-nowrap font-medium text-status-late-fg">
      <TriangleAlert className="size-3.5" aria-hidden="true" /> โหมดสำรอง
    </span>
  );
}

/** Says what changed and what still works, once, at the top of the conversation. */
export function FallbackBanner({ reason }: { reason?: Reason }) {
  return (
    <div role="status" className="rounded-xl border border-status-late-border bg-status-late-bg px-3 py-2.5 text-sm text-status-late-fg">
      <p className="flex items-center gap-1.5 font-semibold">
        <TriangleAlert className="size-4 shrink-0" aria-hidden="true" /> โหมดสำรอง
      </p>
      <p className="mt-0.5 leading-relaxed">
        {reason ? REASON_TEXT[reason] : "AI หลักใช้ไม่ได้ชั่วคราว"} ใช้ปุ่มลัดด้านล่างได้ตามปกติ ตอบจากข้อมูลในระบบ ไม่ใช้ AI ส่วนการร่างข้อความและการอ่านไฟล์ต้องรอ AI กลับมา
      </p>
    </div>
  );
}

const FORM_LABEL: Record<"announce" | "notify", string> = { announce: "ส่งประกาศ", notify: "ส่งแจ้งเตือน" };

/** The quick action buttons. Ones that need a name or a form hand control back to the screen. */
export function QuickChips({
  onRun,
  onPickName,
  onOpenForm,
  disabled,
  className,
}: {
  onRun: (request: QuickRequest, label: string) => void;
  onPickName: () => void;
  onOpenForm: (kind: "announce" | "notify") => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="ปุ่มลัด ตอบจากข้อมูลในระบบ ไม่ใช้ AI">
      {QUICK_ACTIONS.map((a) => {
        const Icon = ICONS[a.icon];
        return (
          <li key={a.id} className="shrink-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (a.needs === "name") onPickName();
                else if (a.needs === "form") onOpenForm(a.id as "announce" | "notify");
                else onRun({ action: a.id }, a.label);
              }}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-sm text-foreground transition hover:border-[var(--chat-teal)] hover:bg-accent hover:text-accent-foreground disabled:opacity-60 md:min-h-9 md:px-3 md:text-[13px]"
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {a.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Announcement or notification written by hand. It only prepares the confirmation card; nothing is sent here. */
export function QuickForm({
  kind,
  initialTitle = "",
  busy,
  onSubmit,
  onCancel,
}: {
  kind: QuickAction & ("announce" | "notify");
  initialTitle?: string;
  busy?: boolean;
  onSubmit: (request: QuickRequest, label: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState("");
  const [target, setTarget] = useState("");
  const [everyone, setEveryone] = useState(false);
  // A notification goes to nobody until the person names someone or says everyone: the widest audience is never a default.
  const ready = title.trim().length > 0 && body.trim().length > 0 && (kind === "announce" || everyone || target.trim().length > 0);
  const field =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-[var(--chat-teal)] focus:ring-3 focus:ring-[var(--chat-teal)]/20 md:text-sm";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || busy) return;
        onSubmit(
          { action: kind, title: title.trim(), body: body.trim(), ...(kind === "notify" ? { target: everyone ? "all" : target.trim() } : {}) },
          `${FORM_LABEL[kind]}: ${title.trim()}`,
        );
      }}
      className="space-y-2.5 rounded-xl border border-border bg-card p-3"
    >
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold">{FORM_LABEL[kind]}</p>
        <button type="button" onClick={onCancel} aria-label="ปิดฟอร์ม" className="ml-auto flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      {kind === "notify" && (
        <div className="space-y-1">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">ถึงใคร</span>
            <input aria-label="ถึงใคร" value={target} onChange={(e) => setTarget(e.target.value)} disabled={everyone} maxLength={100} placeholder="พิมพ์ชื่อหรือรหัสพนักงาน" className={cn(field, "disabled:opacity-50")} />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} className="size-5" />
            ส่งถึงทุกคน
          </label>
        </div>
      )}
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">หัวข้อ</span>
        <input aria-label="หัวข้อ" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={field} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">ข้อความ</span>
        <textarea aria-label="ข้อความ" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={3} className={cn(field, "resize-none")} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={!ready || busy}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[var(--chat-teal)] px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground md:min-h-9"
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          เตรียมการ์ดยืนยัน
        </button>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" aria-hidden="true" /> ยังไม่ส่งจนกว่าจะกดยืนยันที่การ์ด
        </span>
      </div>
    </form>
  );
}
