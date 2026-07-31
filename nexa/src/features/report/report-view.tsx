"use client";

import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";
import { toCsv, downloadCsv } from "@/lib/csv";
import { REPORT_LABELS, REPORT_PERIOD_KIND, REPORT_TYPES, type ReportType } from "./schema";
import { useReport } from "./hooks";

function defaultPeriod(type: ReportType): string {
  const d = new Date();
  const kind = REPORT_PERIOD_KIND[type];
  if (kind === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (kind === "year") return String(d.getFullYear());
  return "";
}

function fmtNum(v: string | number) {
  return typeof v === "number" ? v.toLocaleString("th-TH") : v;
}

export function ReportView() {
  const { can } = useAuth();
  const canExport = can("report:export");

  const [type, setType] = useState<ReportType>("employees");
  const [period, setPeriod] = useState<string>(defaultPeriod("employees"));

  const kind = REPORT_PERIOD_KIND[type];
  const { data, isLoading, isError, refetch } = useReport(type, period || undefined);
  const result = data?.data;

  function changeType(next: ReportType) {
    setType(next);
    setPeriod(defaultPeriod(next));
  }

  function exportCsv() {
    if (!result) return;
    const csv = toCsv(result.columns, result.rows);
    const name = `${type}${result.period ? `-${result.period}` : ""}`;
    downloadCsv(name, csv);
    toast.success("ดาวน์โหลด CSV แล้ว");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">ประเภทรายงาน</label>
            <Select value={type} onValueChange={(v) => changeType(v as ReportType)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {REPORT_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {kind === "month" && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">งวด (เดือน)</label>
              <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-[170px]" />
            </div>
          )}
          {kind === "year" && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">ปี</label>
              <Input
                type="number"
                min={2000}
                max={2100}
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-[120px]"
              />
            </div>
          )}
        </div>

        {canExport && (
          <Button variant="outline" onClick={exportCsv} disabled={!result || result.rows.length === 0}>
            <Download className="size-4" /> ส่งออก CSV
          </Button>
        )}
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={8} />
      ) : !result || result.rows.length === 0 ? (
        <EmptyState icon={FileSpreadsheet} title="ไม่มีข้อมูลสำหรับรายงานนี้" description="ลองเปลี่ยนงวดหรือประเภทรายงาน" />
      ) : (
        <Card className="gap-0 overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {result.columns.map((c) => (
                  <TableHead key={c.key} className={cn(c.numeric && "text-right")}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row, i) => (
                <TableRow key={i}>
                  {result.columns.map((c) => (
                    <TableCell key={c.key} className={cn(c.numeric && "text-right tabular-nums")}>
                      {fmtNum(row[c.key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {result && result.rows.length > 0 && (
        <p className="text-sm text-muted-foreground">รวม {result.rows.length} รายการ</p>
      )}
    </div>
  );
}
