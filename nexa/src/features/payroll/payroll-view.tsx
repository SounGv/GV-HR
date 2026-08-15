"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Wallet, Play, Loader2, Eye, CircleDollarSign, RefreshCcw, Briefcase, CheckCircle2, Mail, Save, Lock } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { useOrgOptions, useUpdateEmployee } from "@/features/employee/hooks";
import { fullName, formatCurrency } from "@/lib/format";
import { ApiError } from "@/lib/api/client";

import {
  usePayroll,
  useGeneratePayroll,
  usePayPayroll,
  useSendPayslipEmails,
  usePayrollPeriodStatus,
  useClosePayrollPeriod,
  payrollKeys,
} from "./hooks";
import { PayslipDialog } from "./payslip-dialog";
import { PayrollFilingExports } from "./filing-exports";
import { PayrollStatusBadge } from "./status-badge";
import type { PayrollRecord } from "./types";

const ALL_DEPARTMENTS = "ALL";

function defaultPeriod() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function PayrollView() {
  const { can } = useAuth();
  const canManage = can("payroll:create") || can("payroll:approve");

  return (
    <Tabs defaultValue="me" className="space-y-4">
      <TabsList>
        <TabsTrigger value="me">สลิปของฉัน</TabsTrigger>
        {canManage && <TabsTrigger value="manage">จัดการเงินเดือน</TabsTrigger>}
      </TabsList>

      <TabsContent value="me">
        <MyPayslips />
      </TabsContent>

      {canManage && (
        <TabsContent value="manage">
          <PayrollAdmin canPay={can("payroll:approve")} />
        </TabsContent>
      )}
    </Tabs>
  );
}

function MyPayslips() {
  const { data, isLoading, isError, refetch } = usePayroll("me");
  const [selected, setSelected] = useState<PayrollRecord | null>(null);
  const records = data?.data ?? [];

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={4} />;
  if (records.length === 0) {
    return <EmptyState icon={Wallet} title="ยังไม่มีสลิปเงินเดือน" description="สลิปจะปรากฏเมื่อฝ่ายบุคคลออกรอบเงินเดือน" />;
  }

  const latest = records[0];

  return (
    <>
      {latest && (
        <Card className="relative mb-4 overflow-hidden border-0 bg-sidebar p-6 text-white">
          <div className="pointer-events-none absolute -top-20 -right-12 size-72 rounded-full bg-primary/25 blur-[90px]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <CircleDollarSign className="size-6 text-primary" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  รายได้สุทธิล่าสุด · {latest.periodLabel}
                </p>
                <p className="mt-0.5 text-4xl font-semibold tracking-tight tabular-nums">
                  {formatCurrency(latest.net)}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="shrink-0 bg-white/10 text-white hover:bg-white/20"
              onClick={() => setSelected(latest)}
            >
              <Eye className="size-4" /> ดูสลิป
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {records.map((r) => (
          <Link key={r.id} href={`/payroll/${r.id}`}>
            <Card className="cursor-pointer gap-2 p-4 transition-colors hover:border-primary/40">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{r.periodLabel}</span>
                <PayrollStatusBadge status={r.status} />
              </div>
              <div className="text-2xl font-semibold text-primary">{formatCurrency(r.net)}</div>
              <p className="text-xs text-muted-foreground">แตะเพื่อดูรายละเอียดสลิป</p>
            </Card>
          </Link>
        ))}
      </div>
      <PayslipDialog record={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </>
  );
}

function PayrollAdmin({ canPay }: { canPay: boolean }) {
  const { can } = useAuth();
  const canSendEmail = can("payroll:export");
  const [period, setPeriod] = useState(defaultPeriod());
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState(ALL_DEPARTMENTS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { data, isLoading, isError, refetch } = usePayroll("all", period);
  const { data: orgData } = useOrgOptions();
  const departments = orgData?.data.departments ?? [];
  const generateMut = useGeneratePayroll();
  const payMut = usePayPayroll();
  const sendEmailMut = useSendPayslipEmails();
  const { data: periodStatusData } = usePayrollPeriodStatus(period);
  const closePeriodMut = useClosePayrollPeriod();
  const [confirmClose, setConfirmClose] = useState(false);
  const [selected, setSelected] = useState<PayrollRecord | null>(null);
  const records = data?.data ?? [];
  const periodClosed = periodStatusData?.data?.closed ?? false;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.data ?? []).filter((r) => {
      if (departmentId !== ALL_DEPARTMENTS && r.employee?.departmentId !== departmentId) return false;
      if (!q) return true;
      const name = r.employee ? fullName(r.employee.firstName, r.employee.lastName).toLowerCase() : "";
      const code = r.employee?.employeeCode?.toLowerCase() ?? "";
      return name.includes(q) || code.includes(q);
    });
  }, [data, search, departmentId]);

  const summary = records.reduce(
    (acc, r) => {
      acc.totalGross += Number(r.gross ?? 0);
      acc.totalNet += Number(r.net ?? 0);
      acc.paid += r.status === "PAID" ? 1 : 0;
      acc.draft += r.status === "DRAFT" ? 1 : 0;
      return acc;
    },
    { totalGross: 0, totalNet: 0, paid: 0, draft: 0 },
  );

  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));
  const someVisibleSelected = filtered.some((r) => selectedIds.has(r.id));

  function toggleAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filtered.forEach((r) => next.delete(r.id));
      } else {
        filtered.forEach((r) => next.add(r.id));
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function generate() {
    try {
      const res = await generateMut.mutateAsync(period);
      toast.success(`ออกรอบเงินเดือน ${res.data.periodLabel} แล้ว (${res.data.count} คน)`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ออกรอบเงินเดือนไม่สำเร็จ");
    }
  }

  async function closePeriod() {
    try {
      await closePeriodMut.mutateAsync(period);
      toast.success(`ปิดงวด ${period} แล้ว — จะประมวลผลหรือแก้ไขรายการในงวดนี้ไม่ได้อีก`);
      setConfirmClose(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ปิดงวดไม่สำเร็จ");
    }
  }

  async function pay(id: string) {
    try {
      await payMut.mutateAsync(id);
      toast.success("ทำเครื่องหมายจ่ายแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  async function sendEmails() {
    try {
      const res = await sendEmailMut.mutateAsync([...selectedIds]);
      const { sent, skipped } = res.data;
      if (sent.length > 0) toast.success(`ส่งสลิปทางอีเมลแล้ว ${sent.length} คน`);
      if (skipped.length > 0) {
        toast.error(`ข้าม ${skipped.length} คน: ${skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}`);
      }
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ส่งอีเมลไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">งวดเงินเดือน</label>
            <Input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-[180px]"
            />
          </div>
          <Button onClick={generate} disabled={generateMut.isPending || periodClosed}>
            {generateMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            ออก/อัปเดตรอบเงินเดือน
          </Button>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCcw className="size-4" /> รีเฟรช
          </Button>
          {canPay &&
            (periodClosed ? (
              <span className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground">
                <Lock className="size-3.5" /> ปิดงวดแล้ว
              </span>
            ) : (
              <Button variant="outline" onClick={() => setConfirmClose(true)} disabled={records.length === 0}>
                <Lock className="size-4" /> ปิดงวด
              </Button>
            ))}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">ค้นหาชื่อ/รหัส</label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาพนักงาน"
              className="w-[180px]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">ฝ่าย</label>
            <Select value={departmentId} onValueChange={(v) => setDepartmentId(v ?? ALL_DEPARTMENTS)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="ทุกฝ่าย" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DEPARTMENTS}>ทุกฝ่าย</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Card className="min-w-[140px] gap-1 border-0 bg-muted/60 p-3">
            <div className="text-xs text-muted-foreground">รายการ</div>
            <div className="text-lg font-semibold">{records.length}</div>
          </Card>
          <Card className="min-w-[140px] gap-1 border-0 bg-muted/60 p-3">
            <div className="text-xs text-muted-foreground">จ่ายแล้ว</div>
            <div className="text-lg font-semibold text-success">{summary.paid}</div>
          </Card>
          <Card className="min-w-[140px] gap-1 border-0 bg-muted/60 p-3">
            <div className="text-xs text-muted-foreground">รอดำเนินการ</div>
            <div className="text-lg font-semibold text-warning">{summary.draft}</div>
          </Card>
        </div>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={5} />
      ) : records.length === 0 ? (
        <EmptyState
          icon={CircleDollarSign}
          title="ยังไม่มีข้อมูลเงินเดือนสำหรับงวดนี้"
          description="กดออกรอบเงินเดือนเพื่อสร้างสลิปจากฐานเงินเดือนพนักงาน"
        />
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Briefcase className="size-4" /> สรุปรอบ {period}: เงินรวม {formatCurrency(summary.totalGross)} · สุทธิ {formatCurrency(summary.totalNet)}
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4" /> พร้อมประมวลผลและจ่ายเงินได้ทันที
            </span>
          </div>

          {canSendEmail && <PayrollFilingExports records={records} period={period} />}

          {canSendEmail && selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
              <span className="text-sm text-foreground">เลือกแล้ว {selectedIds.size} คน</span>
              <Button size="sm" disabled={sendEmailMut.isPending} onClick={sendEmails}>
                {sendEmailMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                ส่งสลิปทางอีเมล ({selectedIds.size})
              </Button>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {canSendEmail && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected}
                      indeterminate={someVisibleSelected && !allVisibleSelected}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                )}
                <TableHead>พนักงาน</TableHead>
                {canSendEmail && <TableHead>อีเมล</TableHead>}
                <TableHead className="text-right">รายได้รวม</TableHead>
                <TableHead className="text-right">รายการหัก</TableHead>
                <TableHead className="text-right">สุทธิ</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  {canSendEmail && (
                    <TableCell>
                      <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                    </TableCell>
                  )}
                  <TableCell>
                    <Link href={`/payroll/${r.id}`} className="block">
                      <div className="font-medium">
                        {r.employee ? fullName(r.employee.firstName, r.employee.lastName) : "-"}
                      </div>
                      <div className="text-xs text-muted-foreground">{r.employee?.employeeCode}</div>
                    </Link>
                  </TableCell>
                  {canSendEmail && (
                    <TableCell>{r.employee && <EmployeeEmailCell employeeId={r.employee.id} email={r.employee.email} />}</TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.gross)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCurrency(r.totalDeductions)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(r.net)}
                  </TableCell>
                  <TableCell>
                    <PayrollStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label="ดูสลิป" onClick={() => setSelected(r)}>
                        <Eye className="size-4" />
                      </Button>
                      {canPay && r.status === "DRAFT" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={payMut.isPending}
                          onClick={() => pay(r.id)}
                        >
                          จ่าย
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canSendEmail ? 8 : 6} className="py-8 text-center text-sm text-muted-foreground">
                    ไม่พบพนักงานตามตัวกรอง
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </div>
      )}

      <PayslipDialog record={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="ปิดงวดเงินเดือน"
        description={`ปิดงวด ${period} แล้วจะไม่สามารถออก/อัปเดตรอบเงินเดือน หรือแก้ไขรายการปรับปรุงของงวดนี้ได้อีก (รายการที่จ่ายแล้วไม่ได้รับผลกระทบอยู่แล้ว) ต้องการดำเนินการต่อหรือไม่?`}
        destructive
        confirmLabel="ปิดงวด"
        cancelLabel="ยกเลิก"
        loading={closePeriodMut.isPending}
        onConfirm={closePeriod}
      />
    </div>
  );
}

function EmployeeEmailCell({ employeeId, email }: { employeeId: string; email: string | null }) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const updateMut = useUpdateEmployee(employeeId);
  const qc = useQueryClient();

  async function save() {
    if (!draft.trim()) {
      toast.error("กรุณาระบุอีเมล");
      return;
    }
    try {
      await updateMut.mutateAsync({ email: draft.trim() });
      await qc.invalidateQueries({ queryKey: payrollKeys.all });
      toast.success("บันทึกอีเมลแล้ว");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  if (email && !editing) {
    return <span className="text-sm text-muted-foreground">{email}</span>;
  }

  if (!editing) {
    return (
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        <Mail className="size-3.5" /> เพิ่มอีเมล
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="อีเมลพนักงาน"
        className="h-8 w-44"
      />
      <Button variant="outline" size="icon-sm" aria-label="บันทึก" onClick={save} disabled={updateMut.isPending}>
        <Save className="size-3.5" />
      </Button>
    </div>
  );
}
