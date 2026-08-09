"use client";

import { useEffect, useState } from "react";
import { Printer, BadgeCheck, CalendarDays, ReceiptText, Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { formatCurrency, fullName } from "@/lib/format";
import { PayrollStatusBadge } from "./status-badge";
import { useUpdatePayrollAdjustments } from "./hooks";
import type { PayrollLineItem, PayrollRecord } from "./types";

type AdjustRow = { label: string; amount: string };

function toRows(items: PayrollLineItem[] | undefined): AdjustRow[] {
  return (items ?? []).map((i) => ({ label: i.label, amount: String(i.amount) }));
}

export function PayslipDialog({
  record,
  open,
  onOpenChange,
}: {
  record: PayrollRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { can } = useAuth();
  const canEdit = can("payroll:update");
  const adjustMut = useUpdatePayrollAdjustments();

  const [earningRows, setEarningRows] = useState<AdjustRow[]>([]);
  const [deductionRows, setDeductionRows] = useState<AdjustRow[]>([]);
  const [noteInput, setNoteInput] = useState("");
  // Freshest saved data, shown instead of the (possibly stale) `record` prop
  // right after a save — the parent's own list refetches independently.
  const [saved, setSaved] = useState<PayrollRecord | null>(null);

  useEffect(() => {
    setSaved(null);
    if (!record) return;
    setEarningRows(toRows(record.manualAdjustments?.earnings));
    setDeductionRows(toRows(record.manualAdjustments?.deductions));
    setNoteInput(record.note ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id]);

  if (!record) return null;
  const view = saved ?? record;
  const name = view.employee
    ? fullName(view.employee.firstName, view.employee.lastName)
    : undefined;
  const canEditThis = canEdit && view.status === "DRAFT";

  async function saveAdjustments() {
    const clean = (rows: AdjustRow[]) =>
      rows
        .filter((r) => r.label.trim() && Number(r.amount) > 0)
        .map((r) => ({ label: r.label.trim(), amount: Number(r.amount) }));
    try {
      const res = await adjustMut.mutateAsync({
        id: record!.id,
        extraEarnings: clean(earningRows),
        extraDeductions: clean(deductionRows),
        note: noteInput,
      });
      setSaved(res.data);
      toast.success("บันทึกรายการเพิ่มเติมเรียบร้อย");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>สลิปเงินเดือน · {view.periodLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3">
            <div>
              {name && <p className="font-medium text-foreground">{name}</p>}
              {view.employee && (
                <p className="text-xs text-muted-foreground">{view.employee.employeeCode}</p>
              )}
            </div>
            <div className="text-right">
              <PayrollStatusBadge status={view.status} />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {view.paidAt ? `จ่ายเมื่อ ${new Date(view.paidAt).toLocaleDateString("th-TH")}` : "ยังไม่จ่าย"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="size-4" />
              <span>รอบ {view.periodLabel}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <ReceiptText className="size-4" />
              <span>อ้างอิง {view.id.slice(0, 8)}</span>
            </div>
          </div>

          <Section title="รายได้">
            {view.earnings.map((e, i) => (
              <Row key={i} label={e.label} value={e.amount} />
            ))}
            <Row label="รวมรายได้" value={view.gross} strong />
          </Section>

          <Section title="รายการหัก">
            {view.deductions.map((d, i) => (
              <Row key={i} label={d.label} value={-d.amount} />
            ))}
            <Row label="รวมรายการหัก" value={-view.totalDeductions} strong />
          </Section>

          {!canEditThis && view.note && (
            <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">หมายเหตุจาก HR: </span>
              {view.note}
            </p>
          )}

          {canEditThis && (
            <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                รายการเพิ่มเติม (โบนัส / ค่าตำแหน่ง / เบิกล่วงหน้า / อื่นๆ) — แก้ไขได้ก่อนจ่ายเท่านั้น
              </p>
              <AdjustList label="รายได้เพิ่มเติม" rows={earningRows} onChange={setEarningRows} />
              <AdjustList label="รายการหักเพิ่มเติม" rows={deductionRows} onChange={setDeductionRows} />
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">หมายเหตุจาก HR (แสดงบนสลิป)</p>
                <Textarea
                  rows={2}
                  className="text-sm"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="เช่น รวมค่าคอมมิชชั่นไตรมาสนี้"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={saveAdjustments}
                disabled={adjustMut.isPending}
              >
                {adjustMut.isPending && <Loader2 className="size-3.5 animate-spin" />}
                บันทึกรายการเพิ่มเติม
              </Button>
            </div>
          )}

          <div className="flex items-start justify-between rounded-lg bg-primary/10 px-4 py-3">
            <div>
              <div className="flex items-center gap-2 font-medium text-foreground">
                <BadgeCheck className="size-4 text-primary" /> เงินเดือนสุทธิ
              </div>
              <p className="mt-1 text-xs text-muted-foreground">ยอดที่โอน/จ่ายจริงในรอบนี้</p>
            </div>
            <span className="text-lg font-semibold text-primary">
              {formatCurrency(view.net)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => window.open(`/payslip/${view.id}`, "_blank")}>
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

function AdjustList({
  label,
  rows,
  onChange,
}: {
  label: string;
  rows: AdjustRow[];
  onChange: (rows: AdjustRow[]) => void;
}) {
  function update(i: number, patch: Partial<AdjustRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input
            className="h-8 flex-1 text-sm"
            placeholder="รายการ เช่น โบนัส"
            value={r.label}
            onChange={(e) => update(i, { label: e.target.value })}
          />
          <Input
            className="h-8 w-28 text-sm"
            type="number"
            min={0}
            placeholder="จำนวนเงิน"
            value={r.amount}
            onChange={(e) => update(i, { amount: e.target.value })}
          />
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(i)} aria-label="ลบ">
            <X className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange([...rows, { label: "", amount: "" }])}
      >
        <Plus className="size-3.5" /> เพิ่มรายการ
      </Button>
    </div>
  );
}
