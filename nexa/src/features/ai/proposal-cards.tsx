"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bell, CalendarCheck, CheckCircle2, ChevronRight, ClipboardCheck, Info, Loader2, Megaphone, TriangleAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { confirmProposal } from "./api";
import type { ProposalCard } from "./types";

type State =
  | { phase: "idle" }
  | { phase: "cancelled" }
  | { phase: "done"; message: string; again: boolean }
  | { phase: "refused"; message: string }
  | { phase: "error"; message: string };

function ProposalTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="max-h-72 overflow-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr className="bg-muted/60 text-left">
            {head.map((h) => (
              <th key={h} className="px-2.5 py-1.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border align-top">
              {r.map((c, j) => (
                <td key={j} className="px-2.5 py-1.5 break-words">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One card น้องวีบอท drew. The action runs only when the person presses the confirm button. */
function ProposalCardView({ card }: { card: ProposalCard }) {
  const [state, setState] = useState<State>({ phase: "idle" });
  const confirm = useMutation({
    mutationFn: () => confirmProposal(card.token),
    onSuccess: (res) => {
      const o = res.data;
      setState(o.status === "refused" ? { phase: "refused", message: o.message } : { phase: "done", message: o.message, again: o.status === "already" });
    },
    onError: (err) => {
      const message = err instanceof ApiError && err.status < 500 && err.status !== 401 ? err.message : "เชื่อมต่อไม่ได้ ตรวจสัญญาณอินเทอร์เน็ต แล้วกดยืนยันอีกครั้ง ถ้าไม่แน่ใจว่าส่งไปหรือยัง ให้ดูในหน้าประกาศหรือแจ้งเตือนก่อน";
      setState({ phase: "error", message });
    },
  });

  const Icon = card.icon === "megaphone" ? Megaphone : card.icon === "calendar" ? CalendarCheck : card.icon === "clipboard" ? ClipboardCheck : Bell;

  return (
    <section
      aria-label={`การ์ดยืนยัน: ${card.title}`}
      className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-border bg-card text-sm text-foreground shadow-sm"
    >
      <header className="flex items-center gap-2.5 border-b border-border bg-accent px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-primary text-primary-foreground">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs leading-snug font-semibold text-accent-foreground">{card.kindLabel} · รอคุณยืนยัน</p>
          <p className="text-base leading-snug font-semibold">{card.title}</p>
        </div>
      </header>

      <div className="space-y-3 px-4 py-3">
        <dl className="grid grid-cols-1 gap-x-3.5 gap-y-1 sm:grid-cols-[96px_1fr]">
          {card.rows.map((r) => (
            <div key={r.label} className="contents">
              <dt className="mt-1.5 text-muted-foreground sm:mt-0">{r.label}</dt>
              <dd className="break-words">{r.value}</dd>
            </div>
          ))}
        </dl>

        {card.preview && (
          <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
            <p className="font-semibold break-words">{card.preview.title}</p>
            <p className="mt-0.5 break-words whitespace-pre-wrap">{card.preview.body}</p>
          </div>
        )}

        {card.table && <ProposalTable head={card.table.head} rows={card.table.rows} />}

        {card.skipped && (
          <div className="text-[13.5px]">
            <p className="font-semibold">{card.skipped.title}</p>
            <ul className="mt-0.5 list-disc space-y-1 pl-5">
              {card.skipped.items.map((t, i) => (
                <li key={i} className="break-words">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {card.detail && (
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 font-semibold text-primary [&::-webkit-details-marker]:hidden">
              {card.detail.label}
              <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden="true" />
            </summary>
            <ProposalTable head={card.detail.head} rows={card.detail.rows} />
          </details>
        )}

        {card.note && state.phase === "idle" && (
          <p className="flex items-start gap-2 rounded-lg border border-status-late-border bg-status-late-bg px-3 py-2 text-status-late-fg">
            <TriangleAlert className="mt-1 size-4 shrink-0" aria-hidden="true" />
            <span>{card.note}</span>
          </p>
        )}
      </div>

      {state.phase === "idle" || state.phase === "error" ? (
        <footer className="space-y-2 border-t border-border px-4 py-3">
          {state.phase === "error" && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-status-absent-border bg-status-absent-bg px-3 py-2 text-status-absent-fg">
              <XCircle className="mt-1 size-4 shrink-0" aria-hidden="true" />
              <span>{state.message}</span>
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2.5">
            <Button type="button" variant="outline" className="min-h-11 px-4 text-sm" disabled={confirm.isPending} onClick={() => setState({ phase: "cancelled" })}>
              ยกเลิก
            </Button>
            <Button type="button" className="min-h-11 px-4 text-sm" disabled={confirm.isPending} onClick={() => confirm.mutate()}>
              {confirm.isPending && <Loader2 className="size-4 animate-spin motion-reduce:animate-pulse" aria-hidden="true" />}
              {confirm.isPending ? "กำลังทำรายการ…" : card.confirmLabel}
            </Button>
          </div>
        </footer>
      ) : (
        <p
          role="status"
          className={cn(
            "flex items-start gap-2 border-t px-4 py-3 font-semibold",
            state.phase === "done" && "border-status-normal-border bg-status-normal-bg text-status-normal-fg",
            state.phase === "refused" && "border-status-absent-border bg-status-absent-bg text-status-absent-fg",
            state.phase === "cancelled" && "border-border bg-muted text-muted-foreground",
          )}
        >
          {state.phase === "done" ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          ) : state.phase === "refused" ? (
            <XCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          ) : (
            <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          )}
          <span>
            {state.phase === "done" && state.message}
            {state.phase === "refused" && state.message}
            {state.phase === "cancelled" && "ยกเลิกแล้ว ไม่มีอะไรถูกส่งหรือเปลี่ยน"}
            {state.phase === "done" && !state.again && <small className="block text-xs font-normal">บันทึกประวัติการทำรายการแล้ว</small>}
          </span>
        </p>
      )}
    </section>
  );
}

export function ProposalCards({ cards }: { cards: ProposalCard[] | undefined }) {
  if (!cards || cards.length === 0) return null;
  return (
    <div className="space-y-2.5">
      {cards.map((c) => (
        <ProposalCardView key={c.token} card={c} />
      ))}
    </div>
  );
}
