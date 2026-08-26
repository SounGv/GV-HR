"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Printer } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { useOrgOptions } from "@/features/employee/hooks";
import { api, type Envelope } from "@/lib/api/client";
import { toCsv, downloadCsv } from "@/lib/csv";
import { formatCurrency, formatDate } from "@/lib/format";
import { EXPENSE_STATUS_LABEL } from "@/features/expense/labels";
import type { ExpenseStatus } from "@/features/expense/types";
import type { MedicalReportRow, LoanReportRow } from "./report-service";

const ALL = "__all";
const YEAR_NOW = new Date().getFullYear();
const YEARS = [YEAR_NOW, YEAR_NOW - 1, YEAR_NOW - 2];

function fetchReport(type: "medical" | "loan", departmentId: string, year: number) {
  const params = new URLSearchParams({ type, year: String(year) });
  if (departmentId !== ALL) params.set("departmentId", departmentId);
  return api.get<Envelope<(MedicalReportRow | LoanReportRow)[]>>(`/api/benefits/report?${params.toString()}`);
}

export function BenefitsReportView() {
  const [tab, setTab] = useState<"medical" | "loan">("medical");
  const [departmentId, setDepartmentId] = useState(ALL);
  const [year, setYear] = useState(YEAR_NOW);
  const { data: orgData } = useOrgOptions();
  const departments = orgData?.data.departments ?? [];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["benefits-report", tab, departmentId, year],
    queryFn: () => fetchReport(tab, departmentId, year),
  });
  const rows = data?.data ?? [];

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, departmentId, year]);

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
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {(["medical", "loan"] as const).map((t) => (
              <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>
                {t === "medical" ? "ค่ารักษาพยาบาล" : "กู้เงินบริษัท"}
              </Button>
            ))}
          </div>
          <Select value={String(year)} onValueChange={(v) => setYear(v ? Number(v) : YEAR_NOW)}>
            <SelectTrigger className="w-32">
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
          <Select value={departmentId} onValueChange={(v) => setDepartmentId(v ?? ALL)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>ทุกแผนก</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 print:hidden">
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
        <MedicalTable rows={rows as MedicalReportRow[]} />
      ) : (
        <LoanTable rows={rows as LoanReportRow[]} />
      )}
    </div>
  );
}

function MedicalTable({ rows }: { rows: MedicalReportRow[] }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-[15px]">
        <thead className="sticky top-0 bg-muted/60 text-left">
          <tr>
            <Th>พนักงาน</Th>
            <Th>แผนก</Th>
            <Th>วงเงินทั้งหมด</Th>
            <Th>ครั้งที่เบิก</Th>
            <Th>อนุมัติสะสม</Th>
            <Th>รออนุมัติ</Th>
            <Th>คงเหลือ</Th>
            <Th>เบิกล่าสุด</Th>
            <Th>ใบลาป่วยอ้างอิง</Th>
            <Th>เอกสารแนบ</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.employeeId}>
              <Td>
                {r.employeeName} <span className="text-muted-foreground">({r.employeeCode})</span>
              </Td>
              <Td>{r.department ?? "-"}</Td>
              <Td>{formatCurrency(r.totalCap)}</Td>
              <Td>{r.claimCount}</Td>
              <Td>{formatCurrency(r.approvedTotal)}</Td>
              <Td>{formatCurrency(r.pendingTotal)}</Td>
              <Td className="font-semibold text-primary">{formatCurrency(r.remaining)}</Td>
              <Td>{r.lastClaimDate ? formatDate(r.lastClaimDate) : "-"}</Td>
              <Td>{r.sickLeaveRefs.length > 0 ? `${r.sickLeaveRefs.length} ใบ` : "-"}</Td>
              <Td>{r.attachments.length > 0 ? `${r.attachments.length} ไฟล์` : "-"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function LoanTable({ rows }: { rows: LoanReportRow[] }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-[15px]">
        <thead className="sticky top-0 bg-muted/60 text-left">
          <tr>
            <Th>พนักงาน</Th>
            <Th>แผนก</Th>
            <Th>เงินเดือน ณ วันที่กู้</Th>
            <Th>จำนวนเงินกู้</Th>
            <Th>วันที่กู้</Th>
            <Th>สถานะ</Th>
            <Th>ใช้สิทธิ์ปีนี้</Th>
            <Th>คงค้าง</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.loanId}>
              <Td>
                {r.employeeName} <span className="text-muted-foreground">({r.employeeCode})</span>
              </Td>
              <Td>{r.department ?? "-"}</Td>
              <Td>{formatCurrency(r.salarySnapshot)}</Td>
              <Td>{formatCurrency(r.amount)}</Td>
              <Td>{formatDate(r.loanDate)}</Td>
              <Td>{EXPENSE_STATUS_LABEL[r.status as ExpenseStatus] ?? r.status}</Td>
              <Td>{r.usageCountThisYear}</Td>
              <Td className="font-semibold text-primary">{formatCurrency(r.outstanding)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="p-3 font-medium text-muted-foreground">{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-3 text-foreground ${className ?? ""}`}>{children}</td>;
}
