"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Printer } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelectField, type MultiSelectOption } from "@/components/shared/multi-select-field";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { useOrgOptions } from "@/features/employee/hooks";
import { api, type Envelope } from "@/lib/api/client";
import { toCsv, downloadCsv } from "@/lib/csv";
import { formatCurrency, formatDate } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";
import { EXPENSE_STATUS_LABEL } from "@/features/expense/labels";
import type { ExpenseStatus } from "@/features/expense/types";
import type { MedicalReportRow, LoanReportRow } from "./report-service";

const YEAR_NOW = new Date().getFullYear();
const YEARS = [YEAR_NOW, YEAR_NOW - 1, YEAR_NOW - 2];

function fetchReport(type: "medical" | "loan", departmentIds: string[], year: number) {
  const params = new URLSearchParams({ type, year: String(year) });
  for (const id of departmentIds) params.append("departmentId", id);
  return api.get<Envelope<(MedicalReportRow | LoanReportRow)[]>>(`/api/benefits/report?${params.toString()}`);
}

export function BenefitsReportView() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<"medical" | "loan">("medical");
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [year, setYear] = useState(YEAR_NOW);
  const { data: orgData } = useOrgOptions();
  const departments = orgData?.data.departments ?? [];
  const departmentOptions: MultiSelectOption[] = departments.map((d) => ({ value: d.id, label: d.name }));

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["benefits-report", tab, departmentIds, year],
    queryFn: () => fetchReport(tab, departmentIds, year),
  });
  const rows = data?.data ?? [];

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, departmentIds, year]);

  function exportCsv() {
    if (rows.length === 0) return;
    if (tab === "medical") {
      const medicalRows = rows as MedicalReportRow[];
      const columns = [
        { key: "employeeCode", label: "รหัสพนักงาน" },
        { key: "employeeName", label: "ชื่อพนักงาน" },
        { key: "department", label: "แผนก" },
        { key: "totalCap", label: "วงเงินทั้งหมด" },
        { key: "claimCount", label: "จำนวนครั้งที่เบิก" },
        { key: "approvedTotal", label: "ยอดอนุมัติสะสม" },
        { key: "pendingTotal", label: "ยอดรออนุมัติ" },
        { key: "remaining", label: "ยอดคงเหลือ" },
        { key: "lastClaimDate", label: "วันที่เบิกล่าสุด" },
        { key: "sickLeaveRefCount", label: "จำนวนใบลาป่วยอ้างอิง" },
        { key: "attachmentCount", label: "จำนวนเอกสารแนบ" },
      ];
      downloadCsv(
        `benefits-medical-report`,
        toCsv(
          columns,
          medicalRows.map((r) => ({
            ...r,
            department: r.department ?? "-",
            lastClaimDate: r.lastClaimDate ? formatDate(r.lastClaimDate) : "-",
            sickLeaveRefCount: r.sickLeaveRefs.length,
            attachmentCount: r.attachments.length,
          })),
        ),
      );
    } else {
      const loanRows = rows as LoanReportRow[];
      const columns = [
        { key: "employeeCode", label: "รหัสพนักงาน" },
        { key: "employeeName", label: "ชื่อพนักงาน" },
        { key: "department", label: "แผนก" },
        { key: "salarySnapshot", label: "เงินเดือน ณ วันที่กู้" },
        { key: "amount", label: "จำนวนเงินกู้" },
        { key: "loanDate", label: "วันที่กู้" },
        { key: "status", label: "สถานะ" },
        { key: "usageCountThisYear", label: "จำนวนครั้งที่ใช้สิทธิ์" },
        { key: "outstanding", label: "จำนวนเงินคงค้าง" },
      ];
      downloadCsv(
        `benefits-loan-report`,
        toCsv(
          columns,
          loanRows.map((r) => ({
            ...r,
            department: r.department ?? "-",
            loanDate: formatDate(r.loanDate),
            status: EXPENSE_STATUS_LABEL[r.status as ExpenseStatus] ?? r.status,
          })),
        ),
      );
    }
    toast.success("ดาวน์โหลด CSV แล้ว");
  }

  async function exportExcel() {
    if (rows.length === 0) return;
    const XLSX = await import("xlsx");
    let header: string[];
    let body: (string | number)[][];
    if (tab === "medical") {
      const medicalRows = rows as MedicalReportRow[];
      header = ["รหัสพนักงาน", "ชื่อพนักงาน", "แผนก", "วงเงินทั้งหมด", "จำนวนครั้งที่เบิก", "ยอดอนุมัติสะสม", "ยอดรออนุมัติ", "ยอดคงเหลือ", "วันที่เบิกล่าสุด", "จำนวนใบลาป่วยอ้างอิง", "จำนวนเอกสารแนบ"];
      body = medicalRows.map((r) => [
        r.employeeCode,
        r.employeeName,
        r.department ?? "-",
        r.totalCap,
        r.claimCount,
        r.approvedTotal,
        r.pendingTotal,
        r.remaining,
        r.lastClaimDate ? formatDate(r.lastClaimDate) : "-",
        r.sickLeaveRefs.length,
        r.attachments.length,
      ]);
    } else {
      const loanRows = rows as LoanReportRow[];
      header = ["รหัสพนักงาน", "ชื่อพนักงาน", "แผนก", "เงินเดือน ณ วันที่กู้", "จำนวนเงินกู้", "วันที่กู้", "สถานะ", "จำนวนครั้งที่ใช้สิทธิ์", "จำนวนเงินคงค้าง"];
      body = loanRows.map((r) => [
        r.employeeCode,
        r.employeeName,
        r.department ?? "-",
        r.salarySnapshot,
        r.amount,
        formatDate(r.loanDate),
        EXPENSE_STATUS_LABEL[r.status as ExpenseStatus] ?? r.status,
        r.usageCountThisYear,
        r.outstanding,
      ]);
    }
    const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, tab === "medical" ? "ค่ารักษาพยาบาล" : "กู้เงินบริษัท");
    XLSX.writeFile(workbook, `benefits-${tab}-report.xlsx`);
    toast.success("ดาวน์โหลด Excel แล้ว");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex gap-1.5 max-sm:[&>button]:h-11 max-sm:[&>button]:flex-1">
            {(["medical", "loan"] as const).map((t) => (
              <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>
                {t === "medical" ? "ค่ารักษาพยาบาล" : "กู้เงินบริษัท"}
              </Button>
            ))}
          </div>
          <Select value={String(year)} onValueChange={(v) => setYear(v ? Number(v) : YEAR_NOW)}>
            <SelectTrigger className="min-w-[120px] w-auto max-w-[320px] max-sm:h-11 max-sm:w-full" aria-label="ปี">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  ปี {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <MultiSelectField
            label="แผนก"
            placeholder="ทุกแผนก"
            options={departmentOptions}
            selected={departmentIds}
            onChange={setDepartmentIds}
            className="max-sm:w-full"
          />
        </div>
        <div className="flex w-full gap-2 print:hidden max-sm:[&>button]:h-11 max-sm:[&>button]:flex-1 sm:w-auto">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="size-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={rows.length === 0}>
            <FileSpreadsheet className="size-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} disabled={rows.length === 0}>
            <Printer className="size-4" /> พิมพ์
          </Button>
        </div>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState title="ไม่มีข้อมูล" description="ยังไม่มีรายการในช่วงที่เลือก" />
      ) : tab === "medical" ? (
        isMobile ? <MedicalCards rows={rows as MedicalReportRow[]} /> : <MedicalTable rows={rows as MedicalReportRow[]} />
      ) : isMobile ? (
        <LoanCards rows={rows as LoanReportRow[]} />
      ) : (
        <LoanTable rows={rows as LoanReportRow[]} />
      )}
    </div>
  );
}

/** One label/value pair in a phone card. */
function Fact({ label, value, strong = false }: { label: string; value: string | number; strong?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? "font-semibold text-primary tabular-nums" : "font-medium tabular-nums"}>{value}</dd>
    </div>
  );
}

function MedicalCards({ rows }: { rows: MedicalReportRow[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.employeeId} className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/60">
          <p className="text-base font-semibold break-words text-foreground">{r.employeeName}</p>
          <p className="text-sm text-muted-foreground">
            {r.employeeCode} · {r.department ?? "ไม่มีแผนก"}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
            <Fact label="คงเหลือ" value={formatCurrency(r.remaining)} strong />
            <Fact label="วงเงินทั้งหมด" value={formatCurrency(r.totalCap)} />
            <Fact label="อนุมัติสะสม" value={formatCurrency(r.approvedTotal)} />
            <Fact label="รออนุมัติ" value={formatCurrency(r.pendingTotal)} />
            <Fact label="ครั้งที่เบิก" value={r.claimCount} />
            <Fact label="เบิกล่าสุด" value={r.lastClaimDate ? formatDate(r.lastClaimDate) : "-"} />
            <Fact label="ใบลาป่วยอ้างอิง" value={r.sickLeaveRefs.length > 0 ? `${r.sickLeaveRefs.length} ใบ` : "-"} />
            <Fact label="เอกสารแนบ" value={r.attachments.length > 0 ? `${r.attachments.length} ไฟล์` : "-"} />
          </dl>
        </li>
      ))}
    </ul>
  );
}

function LoanCards({ rows }: { rows: LoanReportRow[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.loanId} className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/60">
          <p className="text-base font-semibold break-words text-foreground">{r.employeeName}</p>
          <p className="text-sm text-muted-foreground">
            {r.employeeCode} · {r.department ?? "ไม่มีแผนก"}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
            <Fact label="คงค้าง" value={formatCurrency(r.outstanding)} strong />
            <Fact label="จำนวนเงินกู้" value={formatCurrency(r.amount)} />
            <Fact label="วันที่กู้" value={formatDate(r.loanDate)} />
            <Fact label="สถานะ" value={EXPENSE_STATUS_LABEL[r.status as ExpenseStatus] ?? r.status} />
            <Fact label="เงินเดือน ณ วันที่กู้" value={formatCurrency(r.salarySnapshot)} />
            <Fact label="ใช้สิทธิ์ปีนี้" value={r.usageCountThisYear} />
          </dl>
        </li>
      ))}
    </ul>
  );
}

function MedicalTable({ rows }: { rows: MedicalReportRow[] }) {
  return (
    <Card className="p-0">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>พนักงาน</TableHead>
            <TableHead>แผนก</TableHead>
            <TableHead>วงเงินทั้งหมด</TableHead>
            <TableHead>ครั้งที่เบิก</TableHead>
            <TableHead>อนุมัติสะสม</TableHead>
            <TableHead>รออนุมัติ</TableHead>
            <TableHead>คงเหลือ</TableHead>
            <TableHead>เบิกล่าสุด</TableHead>
            <TableHead>ใบลาป่วยอ้างอิง</TableHead>
            <TableHead>เอกสารแนบ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.employeeId}>
              <TableCell>
                {r.employeeName} <span className="text-muted-foreground">({r.employeeCode})</span>
              </TableCell>
              <TableCell>{r.department ?? "-"}</TableCell>
              <TableCell>{formatCurrency(r.totalCap)}</TableCell>
              <TableCell>{r.claimCount}</TableCell>
              <TableCell>{formatCurrency(r.approvedTotal)}</TableCell>
              <TableCell>{formatCurrency(r.pendingTotal)}</TableCell>
              <TableCell className="font-semibold text-primary">{formatCurrency(r.remaining)}</TableCell>
              <TableCell>{r.lastClaimDate ? formatDate(r.lastClaimDate) : "-"}</TableCell>
              <TableCell>{r.sickLeaveRefs.length > 0 ? `${r.sickLeaveRefs.length} ใบ` : "-"}</TableCell>
              <TableCell>{r.attachments.length > 0 ? `${r.attachments.length} ไฟล์` : "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function LoanTable({ rows }: { rows: LoanReportRow[] }) {
  return (
    <Card className="p-0">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>พนักงาน</TableHead>
            <TableHead>แผนก</TableHead>
            <TableHead>เงินเดือน ณ วันที่กู้</TableHead>
            <TableHead>จำนวนเงินกู้</TableHead>
            <TableHead>วันที่กู้</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead>ใช้สิทธิ์ปีนี้</TableHead>
            <TableHead>คงค้าง</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.loanId}>
              <TableCell>
                {r.employeeName} <span className="text-muted-foreground">({r.employeeCode})</span>
              </TableCell>
              <TableCell>{r.department ?? "-"}</TableCell>
              <TableCell>{formatCurrency(r.salarySnapshot)}</TableCell>
              <TableCell>{formatCurrency(r.amount)}</TableCell>
              <TableCell>{formatDate(r.loanDate)}</TableCell>
              <TableCell>{EXPENSE_STATUS_LABEL[r.status as ExpenseStatus] ?? r.status}</TableCell>
              <TableCell>{r.usageCountThisYear}</TableCell>
              <TableCell className="font-semibold text-primary">{formatCurrency(r.outstanding)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
