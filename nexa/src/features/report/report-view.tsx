"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet, Printer, Sparkles, Loader2, TriangleAlert } from "lucide-react";
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
import { MultiSelectField, type MultiSelectOption } from "@/components/shared/multi-select-field";
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
import { useReports } from "./hooks";
import type { ReportParams } from "./api";
import { ReportSummaryChart } from "./report-summary-chart";
import { ReportMobileCards } from "./report-mobile-cards";
import { PhotoCell, type PhotoPreview } from "./report-photo-cell";
import {
  DAILY_EXTRA_COUNT,
  ReportNoteCell,
  ReportStatusBadge,
  buildDailyColumns,
  dailyPhotoPreview,
  dailyRowBarClass,
  dailyRowClass,
  type DisplayColumn,
} from "./attendance-row-style";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ReportResult } from "./types";

const ALL_TYPE = "ALL";
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

/** Photo cells hold a full base64 data URL — useless (and huge) as raw text
 * in a CSV/PDF export or an AI prompt, so those paths drop them. The Excel
 * export is the exception: it embeds them as real thumbnail images instead
 * (see addExcelSheet), since .xlsx is the format HR actually shares/archives
 * these reports in. */
function exportableColumns(result: ReportResult) {
  return result.columns.filter((c) => !c.photo);
}

/** data:image/<ext>;base64,<data> → the pieces exceljs needs, or null if the
 * cell has no photo ("-") or isn't a data URL for some other reason. */
function parseImageDataUrl(value: string | number | undefined): { base64: string; extension: "png" | "jpeg" } | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
  if (!match) return null;
  const extension = match[1].toLowerCase().startsWith("png") ? "png" : "jpeg";
  return { base64: match[2], extension };
}

/** Render one report as a compact text table the AI can reason over. */
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

type Workbook = import("exceljs").Workbook;

type ExcelImage = { base64: string; extension: "png" | "jpeg" };

/** The report now carries photo URLs (not embedded base64). For an Excel
 * export, fetch each distinct photo once (a few at a time) and turn it into
 * the base64 that exceljs embeds, so the sheet still contains real images. A
 * value that is already a data URL is used as is; photos that fail to load are
 * left blank and counted. */
async function loadExcelImages(
  result: ReportResult,
): Promise<{ images: Map<string, ExcelImage>; failed: number }> {
  const images = new Map<string, ExcelImage>();
  const urls = new Set<string>();
  for (const c of result.columns) {
    if (!c.photo) continue;
    for (const row of result.rows) {
      const v = row[c.key];
      if (typeof v === "string" && v.startsWith("/api/")) urls.add(v);
    }
  }
  const queue = [...urls];
  let failed = 0;
  async function worker() {
    for (let url = queue.pop(); url !== undefined; url = queue.pop()) {
      try {
        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        const parsed = parseImageDataUrl(dataUrl);
        if (parsed) images.set(url, parsed);
        else failed++;
      } catch {
        failed++;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, urls.size) }, worker));
  return { images, failed };
}

/** Adds one sheet (real photo thumbnails embedded, not just dropped like
 * CSV/PDF) to an in-progress exceljs workbook — shared by both the
 * per-section "Excel" export and the combined "ส่งออกทั้งหมด" multi-sheet
 * export, so a single report and a multi-type bundle produce byte-identical
 * sheets either way. */
async function addExcelSheet(workbook: Workbook, label: string, result: ReportResult) {
  const columns = result.columns; // photo columns included — embedded as real images below
  const PHOTO_PX = 70;
  const sheet = workbook.addWorksheet(label.slice(0, 31));
  sheet.columns = columns.map((c) => ({ header: c.label, key: c.key, width: c.photo ? 12 : 16 }));
  const { images, failed } = await loadExcelImages(result);
  if (failed > 0) toast.warning(`โหลดรูปไม่สำเร็จ ${failed} รูป ช่องรูปเหล่านั้นจะว่างในไฟล์ Excel`);

  for (const row of result.rows) {
    const textValues: Record<string, string | number> = {};
    for (const c of columns) {
      if (!c.photo) textValues[c.key] = row[c.key] ?? "";
    }
    const excelRow = sheet.addRow(textValues);
    excelRow.height = PHOTO_PX * 0.75; // px → pt

    columns.forEach((c, colIndex) => {
      if (!c.photo) return;
      const value = row[c.key];
      const image = typeof value === "string" && images.has(value) ? images.get(value)! : parseImageDataUrl(value);
      if (!image) return; // "-" (no photo taken) — leave the cell blank
      const imageId = workbook.addImage(image);
      sheet.addImage(imageId, {
        tl: { col: colIndex, row: excelRow.number - 1 },
        ext: { width: PHOTO_PX, height: PHOTO_PX },
      });
    });
  }
}

function downloadWorkbook(workbook: Workbook, fileName: string) {
  return workbook.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  });
}

/** One report type's own card: fetches its data, renders its table/empty/
 * loading states, and carries its own export + AI-summary controls — so
 * selecting several report types at once just stacks several of these,
 * instead of trying to force structurally unrelated tables (attendance vs.
 * payroll vs. leave) into one. */
function ReportSection({
  type,
  result,
  isLoading,
  isError,
  refetch,
  from,
  to,
  canExport,
  canAi,
  onOpenPhoto,
}: {
  type: ReportType;
  result: ReportResult | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  from: string;
  to: string;
  canExport: boolean;
  canAi: boolean;
  onOpenPhoto: (photo: PhotoPreview) => void;
}) {
  const [showExtraColumns, setShowExtraColumns] = useState(false);
  const isMobile = useIsMobile();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");

  function exportCsv() {
    if (!result) return;
    const csv = toCsv(exportableColumns(result), result.rows);
    downloadCsv(`${type}-${from}_${to}`, csv);
    toast.success("ดาวน์โหลด CSV แล้ว");
  }

  async function exportExcel() {
    if (!result) return;
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await addExcelSheet(workbook, REPORT_LABELS[type], result);
    await downloadWorkbook(workbook, `${type}-${from}_${to}.xlsx`);
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

  // Daily attendance report: a focused default set of columns (extras behind a
  // toggle). Every other report shows its columns as the service sent them.
  const isDaily = type === "attendance_daily";
  const displayColumns: DisplayColumn[] = result
    ? isDaily
      ? buildDailyColumns(result.columns, showExtraColumns)
      : result.columns
    : [];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-base font-semibold">{REPORT_LABELS[type]}</h2>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {isDaily && result && result.rows.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-11 md:h-8"
              aria-pressed={showExtraColumns}
              onClick={() => setShowExtraColumns((v) => !v)}
            >
              {showExtraColumns ? "ซ่อนคอลัมน์เพิ่ม" : `แสดงคอลัมน์เพิ่ม (${DAILY_EXTRA_COUNT})`}
            </Button>
          )}
          {canAi && (
            <Button
              variant="outline"
              size="sm"
              onClick={summarizeWithAi}
              disabled={!result || result.rows.length === 0 || aiLoading}
              className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
            >
              {aiLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              AI สรุปรายงาน
            </Button>
          )}
          {canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="sm" disabled={!result || result.rows.length === 0} />}
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

      {result?.truncatedFrom && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-status-late-border bg-status-late-bg px-4 py-3 text-sm text-status-late-fg"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            มีข้อมูลมากเกินกว่าจะแสดงทั้งหมด รายงานนี้จึงแสดงครบตั้งแต่{" "}
            {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "UTC" }).format(
              new Date(`${result.truncatedFrom}T00:00:00.000Z`),
            )}{" "}
            เป็นต้นไป ลดช่วงวันที่ หรือเลือกแผนก/พนักงาน เพื่อดูส่วนที่ถูกตัด
          </p>
        </div>
      )}

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
        <ErrorState onRetry={refetch} />
      ) : isLoading ? (
        <TableLoadingState rows={8} />
      ) : !result || result.rows.length === 0 ? (
        <EmptyState icon={FileSpreadsheet} title="ไม่มีข้อมูลสำหรับรายงานนี้" description="ลองเปลี่ยนงวดหรือประเภทรายงาน" />
      ) : (
        <>
          {!isMobile && (
          <Card className="gap-0 overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {displayColumns.map((c) => {
                    // Long header sentences ("ไม่ลงเวลาออก (วัน)") wrap to 2
                    // lines instead of stretching every column that wide —
                    // the trailing "(unit)" moves to its own smaller, muted
                    // second line so the label itself stays the prominent part.
                    const unitMatch = c.label.match(/^(.+)\s\(([^)]+)\)$/);
                    return (
                      <TableHead
                        key={c.key}
                        className={cn(
                          "leading-tight whitespace-normal",
                          c.key !== "code" && c.key !== "name" && "max-w-[120px]",
                          c.numeric && "text-right",
                          // "รหัส"/"ชื่อ-สกุล" pin to the left edge on every
                          // report type — see service.ts, both keys are always
                          // present and always first/second, in that order —
                          // so scrolling a wide table right never loses track
                          // of which row belongs to whom.
                          c.key === "code" && "sticky left-0 z-20 w-[72px] bg-card",
                          c.key === "name" && "sticky left-[72px] z-20 min-w-[160px] bg-card shadow-[2px_0_4px_-2px_rgb(0_0_0_/_0.15)]",
                        )}
                      >
                        {unitMatch ? (
                          <>
                            {unitMatch[1]}
                            <span className="block text-[11px] font-normal text-muted-foreground">({unitMatch[2]})</span>
                          </>
                        ) : (
                          c.label
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row, i) => {
                  const rowTone = isDaily ? dailyRowClass(row) : undefined;
                  const rowBar = isDaily ? dailyRowBarClass(row) : undefined;
                  // Pinned cells need the row's own tint, otherwise they cover it with the card colour.
                  const pinnedBg = rowTone ? "bg-inherit" : "bg-card";
                  return (
                    <TableRow key={i} className={rowTone}>
                      {displayColumns.map((c, ci) => {
                        const photo = isDaily && c.photo ? dailyPhotoPreview(row, c.key, "") : null;
                        return (
                          <TableCell
                            key={c.key}
                            className={cn(
                              c.numeric && "text-right tabular-nums",
                              ci === 0 && rowBar,
                              c.key === "code" && `sticky left-0 z-10 w-[72px] ${pinnedBg}`,
                              c.key === "name" &&
                                `sticky left-[72px] z-10 min-w-[160px] ${pinnedBg} shadow-[2px_0_4px_-2px_rgb(0_0_0_/_0.15)]`,
                            )}
                          >
                            {c.photo ? (
                              <PhotoCell url={row[c.key]} onOpen={onOpenPhoto} title={photo?.title} lines={photo?.lines} />
                            ) : isDaily && c.key === "status" ? (
                              <ReportStatusBadge statusKey={String(row.statusKey ?? "")} fallback={row.status} />
                            ) : isDaily && c.key === "note" ? (
                              <ReportNoteCell row={row} value={row.note} />
                            ) : (
                              fmtNum(c.value ? c.value(row) : row[c.key])
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
          )}
          {isMobile && (
            <ReportMobileCards result={result} onOpenPhoto={onOpenPhoto} columns={displayColumns} isDaily={isDaily} />
          )}
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
            <DialogDescription>วิเคราะห์โดย AI Assistant จากข้อมูลรายงานปัจจุบัน</DialogDescription>
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
    </section>
  );
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

  // Nav/quick-menu links deep-link here via ?view=<ReportType>, or a
  // comma-joined list of several (e.g. "รายงานการเข้างาน" → /reports?view=attendance,
  // "ขอดูลา+OT คู่กัน" → ?view=leave,overtime).
  const router = useRouter();
  const searchParams = useSearchParams();
  function typesFromUrl(): ReportType[] {
    const raw = searchParams.get("view");
    const ids = raw ? raw.split(",") : [];
    const valid = ids.filter((id): id is ReportType => (REPORT_TYPES as readonly string[]).includes(id));
    return valid.length ? valid : ["employees"];
  }
  const [types, setTypesState] = useState<ReportType[]>(() => typesFromUrl());
  function setTypes(next: ReportType[]) {
    const safe: ReportType[] = next.length ? next : ["employees"];
    setTypesState(safe);
    router.replace(`/reports?view=${safe.join(",")}`, { scroll: false });
  }
  // The sidebar's report submenu items all route to this same /reports page
  // with a different ?view=, so Next.js doesn't remount this component
  // between clicks (same route, just a query-string change) — the useState
  // initializer above only fires once. Re-sync on every searchParams change
  // so switching submenu items while already here actually switches the
  // report instead of being a no-op.
  useEffect(() => {
    setTypesState(typesFromUrl());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [from, setFrom] = useState<string>(firstOfMonth());
  const [to, setTo] = useState<string>(todayStr());
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [employmentType, setEmploymentType] = useState<string>(ALL_TYPE);
  // Same deep-link convention as "view" above — the command palette's
  // employee search links here with ?employeeId= when you're already on
  // the reports page, so picking a person filters the current report
  // instead of navigating away to their profile.
  const initialEmployeeId = searchParams.get("employeeId");
  const [employeeIds, setEmployeeIds] = useState<string[]>(initialEmployeeId ? [initialEmployeeId] : []);
  // useState's initializer only runs on first mount — if you're already on
  // /reports and the palette pushes a new ?employeeId= without a full
  // remount (same route, just a query-string change), pick that up too.
  useEffect(() => {
    const urlEmployeeId = searchParams.get("employeeId");
    if (urlEmployeeId) setEmployeeIds([urlEmployeeId]);
  }, [searchParams]);
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [costCenterIds, setCostCenterIds] = useState<string[]>([]);
  const [photoPreview, setPhotoPreview] = useState<PhotoPreview | null>(null);

  // Every selected report type shares one period control — if they disagree
  // on "month" vs "year" vs "none" this just goes with the first type's kind,
  // which only matters in the (rare) case of mixing e.g. a month-grained and
  // a year-grained report in one go.
  const periodKind = REPORT_PERIOD_KIND[types[0]];
  const selectedYear = Number(from.slice(0, 4)) || YEAR_NOW;
  function setYear(y: number) {
    setFrom(`${y}-01-01`);
    setTo(`${y}-12-31`);
  }

  const { data: orgData } = useOrgOptions();
  // Narrow departments by the selected branch(es), same reasoning as the
  // employee picker below — a department's own branchId decides membership.
  const departments = (orgData?.data.departments ?? []).filter(
    (d) => branchIds.length === 0 || (d.branchId != null && branchIds.includes(d.branchId)),
  );
  const branches = orgData?.data.branches ?? [];
  // Narrow the picker by whichever of the branch/department/employment-type/
  // cost-center filters are already active, so it doesn't keep offering
  // people the chosen filters have already excluded from the report itself.
  const employees = (orgData?.data.managers ?? [])
    .filter((e) => branchIds.length === 0 || (e.branchId != null && branchIds.includes(e.branchId)))
    .filter((e) => departmentIds.length === 0 || (e.departmentId != null && departmentIds.includes(e.departmentId)))
    .filter((e) => employmentType === ALL_TYPE || e.employmentType === employmentType)
    .filter((e) => costCenterIds.length === 0 || (e.costCenterId != null && costCenterIds.includes(e.costCenterId)))
    .sort((a, b) => `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`, "th"));
  // Departments/employees picked before narrowing by a sibling filter can
  // fall outside the now-narrowed list — both just lose the no-longer-valid
  // entries instead of resetting the whole filter to empty.
  useEffect(() => {
    if (!orgData || departmentIds.length === 0) return;
    const validIds = new Set(departments.map((d) => d.id));
    setDepartmentIds((prev) => {
      const next = prev.filter((id) => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchIds, orgData]);
  useEffect(() => {
    if (!orgData || employeeIds.length === 0) return;
    const validIds = new Set(employees.map((e) => e.id));
    setEmployeeIds((prev) => {
      const next = prev.filter((id) => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchIds, departmentIds, employmentType, costCenterIds, orgData]);
  const { data: costCenterData } = useCostCenters();
  const costCenters = costCenterData?.data ?? [];

  const sharedFilters: Omit<ReportParams, "type"> = {
    from,
    to,
    departmentId: departmentIds.length ? departmentIds : undefined,
    employmentType: employmentType === ALL_TYPE ? undefined : employmentType,
    employeeId: employeeIds.length ? employeeIds : undefined,
    branchId: branchIds.length ? branchIds : undefined,
    costCenterId: costCenterIds.length ? costCenterIds : undefined,
  };
  const results = useReports(types.map((t) => ({ type: t, ...sharedFilters })));
  const anyResult = results.some((r) => (r.data?.data?.rows.length ?? 0) > 0);

  async function exportAllExcel() {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    let any = false;
    for (let i = 0; i < types.length; i++) {
      const result = results[i].data?.data;
      if (!result || result.rows.length === 0) continue;
      await addExcelSheet(workbook, REPORT_LABELS[types[i]], result);
      any = true;
    }
    if (!any) return;
    await downloadWorkbook(workbook, `reports-${from}_${to}.xlsx`);
    toast.success("ดาวน์โหลด Excel แล้ว (รวมทุกหัวข้อที่เลือก)");
  }

  const employeeOptions: MultiSelectOption[] = employees.map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName} (${e.employeeCode})`,
  }));
  const departmentOptions: MultiSelectOption[] = departments.map((d) => ({ value: d.id, label: d.name }));
  const branchOptions: MultiSelectOption[] = branches.map((b) => ({ value: b.id, label: b.name }));
  const costCenterOptions: MultiSelectOption[] = costCenters.map((c) => ({ value: c.id, label: c.name }));
  const reportTypeOptions: MultiSelectOption[] = visibleReportTypes.map((t) => ({ value: t, label: REPORT_LABELS[t] }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <MultiSelectField
            label="หัวข้อรายงาน"
            placeholder="เลือกหัวข้อรายงาน"
            options={reportTypeOptions}
            selected={types}
            onChange={(next) => setTypes(next as ReportType[])}
          />

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
                <SelectTrigger className="min-w-[120px] w-auto max-w-[320px]">
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
        </div>

        <div className="flex items-center gap-2 print:hidden">
          {canExport && types.length > 1 && (
            <Button variant="outline" onClick={exportAllExcel} disabled={!anyResult}>
              <Download className="size-4" /> ส่งออกทั้งหมด (Excel)
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()} disabled={!anyResult}>
            <Printer className="size-4" /> พิมพ์
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <MultiSelectField label="แผนก" placeholder="ทุกแผนก" options={departmentOptions} selected={departmentIds} onChange={setDepartmentIds} />
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">ประเภทการจ้าง</label>
          <Select value={employmentType} onValueChange={(v) => setEmploymentType(v ?? ALL_TYPE)}>
            <SelectTrigger className="min-w-[160px] w-auto max-w-[320px]">
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
        <MultiSelectField label="พนักงาน" placeholder="ทุกคน" options={employeeOptions} selected={employeeIds} onChange={setEmployeeIds} />
        <MultiSelectField label="สาขา" placeholder="ทุกสาขา" options={branchOptions} selected={branchIds} onChange={setBranchIds} />
        <MultiSelectField
          label="ศูนย์ต้นทุน"
          placeholder="ทุกศูนย์ต้นทุน"
          options={costCenterOptions}
          selected={costCenterIds}
          onChange={setCostCenterIds}
        />
      </div>

      {types.map((t, i) => (
        <ReportSection
          key={t}
          type={t}
          result={results[i].data?.data}
          isLoading={results[i].isLoading}
          isError={results[i].isError}
          refetch={() => results[i].refetch()}
          from={from}
          to={to}
          canExport={canExport}
          canAi={canAi}
          onOpenPhoto={setPhotoPreview}
        />
      ))}

      <Dialog open={!!photoPreview} onOpenChange={(open) => !open && setPhotoPreview(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{photoPreview?.title ?? "รูปถ่ายลงเวลา"}</DialogTitle>
            {photoPreview?.lines && photoPreview.lines.length > 0 && (
              <DialogDescription>
                {photoPreview.lines.map((line, i) => (
                  <span key={i} className="block">
                    {line}
                  </span>
                ))}
              </DialogDescription>
            )}
          </DialogHeader>
          {photoPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPreview.url}
              alt={photoPreview.title ?? "รูปถ่ายลงเวลา"}
              className="w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
