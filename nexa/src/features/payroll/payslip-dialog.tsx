"use client";

import { Printer, BadgeCheck, CalendarDays, ReceiptText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency, fullName } from "@/lib/format";
import { PayrollStatusBadge } from "./status-badge";
import type { PayrollRecord } from "./types";

export function PayslipDialog({
  record,
  open,
  onOpenChange,
}: {
  record: PayrollRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!record) return null;
  const name = record.employee
    ? fullName(record.employee.firstName, record.employee.lastName)
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>สลิปเงินเดือน · {record.periodLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3">
            <div>
              {name && <p className="font-medium text-foreground">{name}</p>}
              {record.employee && (
                <p className="text-xs text-muted-foreground">{record.employee.employeeCode}</p>
              )}
            </div>
            <div className="text-right">
              <PayrollStatusBadge status={record.status} />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {record.paidAt ? `จ่ายเมื่อ ${new Date(record.paidAt).toLocaleDateString("th-TH")}` : "ยังไม่จ่าย"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="size-4" />
              <span>รอบ {record.periodLabel}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <ReceiptText className="size-4" />
              <span>อ้างอิง {record.id.slice(0, 8)}</span>
            </div>
          </div>

          <Section title="รายได้">
            {record.earnings.map((e, i) => (
              <Row key={i} label={e.label} value={e.amount} />
            ))}
            <Row label="รวมรายได้" value={record.gross} strong />
          </Section>

          <Section title="รายการหัก">
            {record.deductions.map((d, i) => (
              <Row key={i} label={d.label} value={-d.amount} />
            ))}
            <Row label="รวมรายการหัก" value={-record.totalDeductions} strong />
          </Section>

          <div className="flex items-start justify-between rounded-lg bg-primary/10 px-4 py-3">
            <div>
              <div className="flex items-center gap-2 font-medium text-foreground">
                <BadgeCheck className="size-4 text-primary" /> เงินเดือนสุทธิ
              </div>
              <p className="mt-1 text-xs text-muted-foreground">ยอดที่โอน/จ่ายจริงในรอบนี้</p>
            </div>
            <span className="text-lg font-semibold text-primary">
              {formatCurrency(record.net)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => window.open(`/payslip/${record.id}`, "_blank")}>
            <Printer className="size-4" /> พิมพ์ / PDF
          </Button>
          <Button onClick={() => onOpenChange(false)}>ปิด</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={strong ? "font-medium text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      <span className={strong ? "font-semibold tabular-nums" : "tabular-nums"}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}
