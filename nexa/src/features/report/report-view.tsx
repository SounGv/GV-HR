"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet, Printer, Sparkles, Loader2 } from "lucide-react";
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
import { EMPLOYMENT_TYPES } from "@/features/employee/schema";
import { EMPLOYMENT_LABEL } from "@/features/employee/labels";
import type { EmploymentType } from "@/features/employee/types";
import { sendChat } from "@/features/ai/api";
import { useAiAccess } from "@/features/ai/hooks";
import { cn } from "@/lib/utils";
import { toCsv, downloadCsv } from "@/lib/csv";
import { REPORT_LABELS, REPORT_TYPES, REPORT_PERIOD_KIND, type ReportType } from "./schema";
import { useCostCenters } from "@/features/cost-center/hooks";
import { useReport } from "./hooks";
import { ReportSummaryChart } from "./report-summary-chart";
import { ReportMobileCards } from "./report-mobile-cards";
import { PhotoCell } from "./report-photo-cell";
import type { ReportResult } from "./types";

const ALL_DEPT = "ALL";
const ALL_TYPE = "ALL";
const ALL_EMPLOYEE = "ALL";
const ALL_BRANCH = "ALL";
const ALL_COST_CENTER = "ALL";
const YEAR_NOW = new Date().getFullYear();
const REPORT_YEARS = [YEAR_NOW, YEAR_NOW - 1, YEAR_NOW - 2, YEAR_NOW - 3];
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

/** Photo cells hold a full base64 data URL — useless (and huge) in a CSV/
 * Excel/PDF export or an AI prompt, so every export path drops them first. */
function exportableColumns(result: ReportResult) {
  return result.columns.filter((c) => !c.photo);
}

/** Render the report as a compact text table the AI can reason over. */
function reportToPrompt(label: string, result: ReportResult): string {
  const MAX_ROWS = 60;
  const columns = exportableColumns(result);
  const header = columns.map((c) => c.label).join(" | ");
  const body = result.rows
    .slice(0, MAX_ROWS)
    .map((row) => columns.map((c) => String(row[c.key] ?? "")).join(" | "))
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
  // Payroll figures are more sensitive than plain report:read implies — hide
  // the option entirely rather than let someone pick it and hit a 403 (the
  // API enforces the same payroll:read gate independently, see
  // src/app/api/reports/route.ts's TYPE_PERMISSION).
  const visibleReportTypes = REPORT_TYPES.filter((t) => t !== "payroll" || can("payroll:read"));
  const { data: aiAccess } = useAiAccess();
  const canAi = !!aiAccess?.data.allowed;

  // Nav/quick-menu links deep-link here via ?view=<ReportType> (e.g.
  // "รายงานการเข้างาน" → /reports?view=attendance).
  const searchParams = useSearchParams();
  const initialView = searchParams.get("view");
  const [type, setType] = useState<ReportType>(
    initialView && (REPORT_TYPES as readonly string[]).includes(initialView) ? (initialView as ReportType) : "employees",
  );
  // The sidebar's report submenu items all route to this same /reports page
  // with a different ?view=, so Next.js doesn't remount this component
  // between clicks (same route, just a query-string change) — the useState
  // initializer above only fires once. Re-sync on every searchParams change
  // so switching submenu items while already here actually switches the
  // report instead of being a no-op.
  useEffect(() => {
    const view = searchParams.get("view");
    if (view && (REPORT_TYPES as readonly string[]).includes(view)) setType(view as ReportType);
  }, [searchParams]);
  const [from, setFrom] = useState<string>(firstOfMonth());
  const [to, setTo] = useState<string>(todayStr());
  const [departmentId, setDepartmentId] = useState<string>(ALL_DEPT);
  const [employmentType, setEmploymentType] = useState<string>(ALL_TYPE);
  // Same deep-link convention as "view" above — the command palette's
  // employee search links here with ?employeeId= when you're already on
  // the reports page, so picking a person filters the current report
  // instead of navigating away to their profile.
  const initialEmployeeId = searchParams.get("employeeId");
  const [employeeId, setEmployeeId] = useState<string>(initialEmployeeId ?? ALL_EMPLOYEE);
  // useState's initializer only runs on first mount — if you're already on
  // /reports and the palette pushes a new ?employeeId= without a full
  // remount (same route, just a query-string change), pick that up too.
  useEffect(() => {
    const urlEmployeeId = searchParams.get("employeeId");
    if (urlEmployeeId) setEmployeeId(urlEmployeeId);
  }, [searchParams]);
  const [branchId, setBranchId] = useState<string>(ALL_BRANCH);
  const [costCenterId, setCostCenterId] = useState<string>(ALL_COST_CENTER);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Some report types are period-less ("none") or year-grained ("year")
  // rather than the default day-range — the filter bar below swaps in a
  // year Select or hides the date inputs entirely to match, instead of
  // showing a day-precision range that the query underneath just ignores.
  const periodKind = REPORT_PERIOD_KIND[type];
  const selectedYear = Number(from.slice(0, 4)) || YEAR_NOW;
  function setYear(y: number) {
    setFrom(`${y}-01-01`);
    setTo(`${y}-12-31`);
  }

  const { data: orgData } = useOrgOptions();
  const departments = orgData?.data.departments ?? [];
  const branches = orgData?.data.branches ?? [];
  const employees = [...(orgData?.data.managers ?? [])].sort((a, b) =>
    `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`, "th"),
  );
  const { data: costCenterData } = useCostCenters();
  const costCenters = costCenterData?.data ?? [];

  const { data, isLoading, isError, refetch } = useReport({
    type,
    from,
    to,
    departmentId: departmentId === ALL_DEPT ? undefined : departmentId,
    employmentType: employmentType === ALL_TYPE ? undefined : employmentType,
    employeeId: employeeId === ALL_EMPLOYEE ? undefined : employeeId,
    branchId: branchId === ALL_BRANCH ? undefined : branchId,
    costCenterId: costCenterId === ALL_COST_CENTER ? undefined : costCenterId,
  });
  const result = data?.data;

  function exportCsv() {
    if (!result) return;
    const csv = toCsv(exportableColumns(result), result.rows);
    const name = `${type}-${from}_${to}`;
    downloadCsv(name, csv);
    toast.success("ดาวน์โหลด CSV แล้ว");
  }

  async function exportExcel() {
    if (!result) return;
    const columns = exportableColumns(result);
    const XLSX = await import("xlsx");
    const header = columns.map((c) => c.label);
    const body = result.rows.map((r) => columns.map((c) => r[c.key] ?? ""));
    const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, REPORT_LABELS[type].slice(0, 31));
    XLSX.writeFile(workbook, `${type}-${from}_${to}.xlsx`);
    toast.success("ดาวน์โหลด Excel แล้ว");
  }

  async function exportPdf() {
    if (!result) return;
    const columns = exportableColumns(result);
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const { registerThaiFont } = await import("@/lib/pdf-fonts");
    const doc = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait" });
    const fontName = await registerThaiFont(doc);
    doc.setFont(fontName);
    doc.setFontSize(12);
    doc.text(`${REPORT_LABELS[type]} (${from} - ${to})`, 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [columns.map((c) => c.label)],
      body: result.rows.map((r) => columns.map((c) => String(r[c.key] ?? ""))),
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
              <SelectContent alignItemWithTrigger={false}>
                {visibleReportTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {REPORT_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {periodKind === "month" && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">ตั้งแต่วันที่</label>
                <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">ถึงวันที่</label>
                <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
              </div>
            </>
          )}
          {periodKind === "year" && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">ปี</label>
              <Select value={String(selectedYear)} onValueChange={(v) => setYear(v ? Number(v) : YEAR_NOW)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {REPORT_YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      ปี {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">แผนก</label>
            <Select value={departmentId} onValueChange={(v) => setDepartmentId(v ?? ALL_DEPT)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="ทุกแผนก" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value={ALL_DEPT}>ทุกแผนก</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">ประเภทการจ้าง</label>
            <Select value={employmentType} onValueChange={(v) => setEmploymentType(v ?? ALL_TYPE)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="ทุกประเภท" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value={ALL_TYPE}>ทุกประเภท</SelectItem>
                {EMPLOYMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {EMPLOYMENT_LABEL[t as EmploymentType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">พนักงาน</label>
            <Select value={employeeId} onValueChange={(v) => setEmployeeId(v ?? ALL_EMPLOYEE)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="ทุกคน" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value={ALL_EMPLOYEE}>ทุกคน</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} ({e.employeeCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">สาขา</label>
            <Select value={branchId} onValueChange={(v) => setBranchId(v ?? ALL_BRANCH)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="ทุกสาขา" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value={ALL_BRANCH}>ทุกสาขา</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">ศูนย์ต้นทุน</label>
            <Select value={costCenterId} onValueChange={(v) => setCostCenterId(v ?? ALL_COST_CENTER)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="ทุกศูนย์ต้นทุน" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value={ALL_COST_CENTER}>ทุกศูนย์ต้นทุน</SelectItem>
                {costCenters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
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
          <Button
            variant="outline"
            onClick={() => window.print()}
            disabled={!result || result.rows.length === 0}
          >
            <Printer className="size-4" /> พิมพ์
          </Button>
        </div>
      </div>

      {result && result.summary && result.summary.length > 0 && (
        <ReportSummaryChart data={result.summary} label={result.summaryLabel} unit={result.summaryUnit} />
      )}

      {result && result.secondarySummary && result.secondarySummary.length > 0 && (
        <ReportSummaryChart
          data={result.secondarySummary}
          label={result.secondarySummaryLabel}
          unit={result.secondarySummaryUnit}
        />
      )}

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={8} />
      ) : !result || result.rows.length === 0 ? (
        <EmptyState icon={FileSpreadsheet} title="ไม่มีข้อมูลสำหรับรายงานนี้" description="ลองเปลี่ยนงวดหรือประเภทรายงาน" />
      ) : (
        <>
          <Card className="hidden gap-0 overflow-x-auto p-0 md:block print:block">
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
                        {c.photo ? (
                          <PhotoCell url={row[c.key]} onOpen={setPhotoPreview} />
                        ) : (
                          fmtNum(row[c.key])
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <ReportMobileCards result={result} onOpenPhoto={setPhotoPreview} />
        </>
      )}

      {result && result.rows.length > 0 && (
        <p className="text-sm text-muted-foreground">{result.footnote ?? `รวม ${result.rows.length} รายการ`}</p>
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

      <Dialog open={!!photoPreview} onOpenChange={(open) => !open && setPhotoPreview(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>รูปถ่ายลงเวลา</DialogTitle>
          </DialogHeader>
          {photoPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreview} alt="รูปถ่ายลงเวลา" className="w-full rounded-lg object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
