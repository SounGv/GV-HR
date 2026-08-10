"use client";

import { useState } from "react";
import { Wallet, ChevronDown, Printer } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { usePayroll } from "./hooks";
import { PayrollStatusBadge } from "./status-badge";
import type { PayrollLineItem, PayrollRecord } from "./types";

/**
 * Mobile-first payslip list — a hero card for the latest slip plus a tap-to-
 * expand accordion for every slip (current one included), instead of the
 * desktop grid-of-cards-that-open-a-dialog pattern. Payroll administration
 * (`PayrollAdmin`) stays desktop-only; running a payroll cycle needs the
 * full table and isn't a phone task.
 */
export function MobileMyPayslips() {
  const { data, isLoading, isError, refetch } = usePayroll("me");
  const records = data?.data ?? [];
  const [openId, setOpenId] = useState<string | null>(null);

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={4} />;
  if (records.length === 0) {
    return <EmptyState icon={Wallet} title="ยังไม่มีสลิปเงินเดือน" description="สลิปจะปรากฏเมื่อฝ่ายบุคคลออกรอบเงินเดือน" />;
  }

  const [latest, ...history] = records;

  return (
    <div className="space-y-4">
      <Card className="relative gap-1 overflow-hidden border-0 bg-sidebar p-5 text-white">
        <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-primary/25 blur-[80px]" />
        <p className="relative text-xs font-medium tracking-wider text-slate-400 uppercase">
          รายได้สุทธิล่าสุด · {latest.periodLabel}
        </p>
        <p className="relative mt-1 text-3xl font-semibold tracking-tight tabular-nums">{formatCurrency(latest.net)}</p>
        <div className="relative mt-1.5">
          <PayrollStatusBadge status={latest.status} />
        </div>
      </Card>

      <PayslipAccordionItem
        record={latest}
        open={openId === latest.id}
        onToggle={() => setOpenId((v) => (v === latest.id ? null : latest.id))}
      />

      {history.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">ประวัติสลิป</h2>
          <div className="space-y-2">
            {history.map((r) => (
              <PayslipAccordionItem
                key={r.id}
                record={r}
                open={openId === r.id}
                onToggle={() => setOpenId((v) => (v === r.id ? null : r.id))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PayslipAccordionItem({
  record,
  open,
  onToggle,
}: {
  record: PayrollRecord;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 p-4 text-left active:bg-muted"
      >
        <div>
          <p className="font-medium text-foreground">{record.periodLabel}</p>
          <p className="text-xs text-muted-foreground">สุทธิ {formatCurrency(record.net)}</p>
        </div>
        <div className="flex items-center gap-2">
          <PayrollStatusBadge status={record.status} />
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border p-4 text-sm">
          <LineItems title="รายได้" items={record.earnings} />
          <Row label="รวมรายได้" value={record.gross} strong />
          <LineItems title="รายการหัก" items={record.deductions} negative />
          <Row label="รวมรายการหัก" value={-record.totalDeductions} strong />
          {record.note && (
            <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">หมายเหตุจาก HR: </span>
              {record.note}
            </p>
          )}
          <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2.5">
            <span className="text-sm font-medium text-foreground">เงินเดือนสุทธิ</span>
            <span className="text-base font-semibold text-primary">{formatCurrency(record.net)}</span>
          </div>
          <a
            href={`/payslip/${record.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm font-medium text-foreground active:bg-muted"
          >
            <Printer className="size-4" /> พิมพ์ / PDF
          </a>
        </div>
      )}
    </Card>
  );
}

function LineItems({ title, items, negative }: { title: string; items: PayrollLineItem[]; negative?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {items.map((it, i) => (
        <Row key={i} label={it.label} value={negative ? -it.amount : it.amount} />
      ))}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={cn("tabular-nums", strong && "font-semibold")}>{formatCurrency(value)}</span>
    </div>
  );
}
