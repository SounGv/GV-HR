"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useOrgOptions } from "@/features/employee/hooks";
import { sendChat } from "@/features/ai/api";
import { cn } from "@/lib/utils";
import { toCsv, downloadCsv } from "@/lib/csv";
import { REPORT_LABELS, REPORT_TYPES, type ReportType } from "./schema";
import { useReport } from "./hooks";
import type { ReportResult } from "./types";

const ALL_DEPT = "ALL";
function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtNum(v: string | number) {
  return typeof v === "number" ? v.toLocaleString("th-TH") : v;
}

/** Render the report as a compact text table the AI can reason over. */
function reportToPrompt(label: string, result: ReportResult): string {
  const MAX_ROWS = 60;
  const header = result.columns.map((c) => c.label).join(" | ");
  const body = result.rows
    .slice(0, MAX_ROWS)
    .map((row) => result.columns.map((c) => String(row[c.key] ?? "")).join(" | "))
    .join("\n");
  const omitted =
    result.rows.length > MAX_ROWS ? `\n(แสดง ${MAX_ROWS} จาก ${result.rows.length} แถว)` : "";
  return [
    `นี่คือรายงาน "${label}"${result.period ? ` งวด ${result.period}` : ""} จากระบบ GV One`,
    "",
    header,
    body,
    omitted,
    "",
    "ช่วยสรุปเชิงผู้บริหาร (3-5 bullet): แนวโน้ม จุดที่ควรสนใจ ค่าผิดปกติ และข้อเสนอแนะเชิงปฏิบัติ",
    "ตอบเป็นภาษาไทยกระชับ อ้างอิงตัวเลขจากตารางนี้เท่านั้น ไม่ต้องเรียกเครื่องมือใด",
  ].join("\n");
}

export function ReportView() {
  const { can } = useAuth();
  const canExport = can("report:export");
  const canAi = can("ai:read");

  const [type, setType] = useState<ReportType>("employees");
  const [from, setFrom] = useState<string>(firstOfMonth());
  const [to, setTo] = useState<string>(todayStr());
  const [departmentId, setDepartmentId] = useState<string>(ALL_DEPT);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");

  const { data: orgData } = useOrgOptions();
  const departments = orgData?.data.departments ?? [];

  const { data, isLoading, isError, refetch } = useReport({
    type,
    from,
    to,
    departmentId: departmentId === ALL_DEPT ? undefined : departmentId,
  });
  const result = data?.data;

  function exportCsv() {
    if (!result) return;
    const csv = toCsv(result.columns, result.rows);
    const name = `${type}-${from}_${to}`;
    downloadCsv(name, csv);
    toast.success("ดาวน์โหลด CSV แล้ว");
  }

  async function exportExcel() {
    if (!result) return;
    const XLSX = await import("xlsx");
    const header = result.columns.map((c) => c.label);
    const body = result.rows.map((r) => result.columns.map((c) => r[c.key] ?? ""));
    const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, REPORT_LABELS[type].slice(0, 31));
    XLSX.writeFile(workbook, `${type}-${from}_${to}.xlsx`);
    toast.success("ดาวน์โหลด Excel แล้ว");
  }

  async function exportPdf() {
    if (!result) return;
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const { registerThaiFont } = await import("@/lib/pdf-fonts");
    const doc = new jsPDF({ orientation: result.columns.length > 6 ? "landscape" : "portrait" });
    const fontName = await registerThaiFont(doc);
    doc.setFont(fontName);
    doc.setFontSize(12);
    doc.text(`${REPORT_LABELS[type]} (${from} - ${to})`, 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [result.columns.map((c) => c.label)],
      body: result.rows.map((r) => result.columns.map((c) => String(r[c.key] ?? ""))),
      styles: { font: fontName, fontSize: 9 },
      headStyles: { font: fontName, fontStyle: "bold", fillColor: [79, 70, 229] },
    });
    doc.save(`${type}-${from}_${to}.pdf`);
    toast.success("ดาวน์โหลด PDF แล้ว");
  }

  async function summarizeWithAi() {
    if (!result) return;
    setAiOpen(true);
    setAiLoading(true);
    setAiText("");
    try {
      const prompt = reportToPrompt(REPORT_LABELS[type], result);
      const res = await sendChat([{ role: "user", content: prompt }]);
      setAiText(res.data.reply);
    } catch {
      setAiText("ขออภัย ไม่สามารถวิเคราะห์รายงานได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">หัวข้อรายงาน</label>
            <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
              <SelectTrigger className="w-[200px]">
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

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">ตั้งแต่วันที่</label>
            <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">ถึงวันที่</label>
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">แผนก</label>
            <Select value={departmentId} onValueChange={(v) => setDepartmentId(v ?? ALL_DEPT)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="ทุกแผนก" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DEPT}>ทุกแผนก</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canAi && (
            <Button
              variant="outline"
              onClick={summarizeWithAi}
              disabled={!result || result.rows.length === 0 || aiLoading}
              className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
            >
              {aiLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              AI สรุปรายงาน
            </Button>
          )}
          {canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" disabled={!result || result.rows.length === 0} />}
              >
                <Download className="size-4" /> ส่งออก
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportCsv}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={exportExcel}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={exportPdf}>PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
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

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="size-4 text-primary" />
              </span>
              AI สรุปรายงาน · {REPORT_LABELS[type]}
            </DialogTitle>
            <DialogDescription>
              วิเคราะห์โดย AI Assistant จากข้อมูลรายงานปัจจุบัน
            </DialogDescription>
          </DialogHeader>
          {aiLoading ? (
            <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary" />
              กำลังวิเคราะห์รายงาน...
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {aiText}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
