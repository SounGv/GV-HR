import { fetchReport } from "@/features/report/api";
import { REPORT_LABELS, type ReportType } from "@/features/report/schema";
import { rankAttendance, toAttendanceRow } from "./rank-attendance";
import type { ChatStep } from "./types";

/** "YYYY-MM" → that month; "YYYY" → that year; anything else → the report's default period. */
function periodRange(period?: string): { from?: string; to?: string } {
  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${period}-01`, to: `${period}-${String(last).padStart(2, "0")}` };
  }
  if (period && /^\d{4}$/.test(period)) return { from: `${period}-01-01`, to: `${period}-12-31` };
  return {};
}

/** Markdown reply → plain rows for a sheet (tables become cells, markers are dropped). */
function replyRows(md: string): string[][] {
  const rows: string[][] = [];
  for (const raw of md.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (/^\|?\s*:?-{2,}/.test(line)) continue; // table divider
    if (/^\|.*\|$/.test(line)) {
      rows.push(line.replace(/^\||\|$/g, "").split("|").map((c) => c.replace(/\*\*/g, "").trim()));
      continue;
    }
    const text = line
      .replace(/^#{1,4}\s+/, "")
      .replace(/^[-*•]\s+/, "• ")
      .replace(/\*\*/g, "");
    rows.push([text]);
  }
  return rows;
}

/**
 * Builds and downloads an Excel file for one AI answer: the AI's summary,
 * plus — when the answer read an HR report — that same report fetched fresh
 * (real numbers, every person, not the 10 rows the chat shows). For the
 * monthly attendance report it adds a ranked sheet (absent → late → leave).
 *
 * @returns the file name that was downloaded.
 */
export async function exportAnswerToExcel(answer: { content: string; question?: string; steps?: ChatStep[] }): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  const { addExcelSheet, downloadWorkbook } = await import("@/features/report/report-view");
  const wb = new ExcelJS.Workbook();

  const summary = wb.addWorksheet("สรุปจาก AI");
  summary.columns = [{ width: 60 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
  summary.addRow([`คำถาม: ${answer.question ?? "-"}`]).font = { bold: true };
  summary.addRow([`สร้างเมื่อ ${new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date())}`]);
  summary.addRow([]);
  for (const r of replyRows(answer.content)) summary.addRow(r);

  const report = answer.steps?.find((s) => s.report)?.report;
  let fileTag = "AI";
  if (report && report.type in REPORT_LABELS) {
    const type = report.type as ReportType;
    const res = await fetchReport({ type, ...periodRange(report.period) });
    const result = res.data;
    fileTag = `${type}-${report.period ?? "ล่าสุด"}`;

    if (type === "attendance") {
      const ranked = rankAttendance(result.rows.map((r) => toAttendanceRow(r as Record<string, unknown>)));
      const sheet = wb.addWorksheet("อันดับ ขาด-สาย-ลา");
      sheet.columns = [
        { header: "อันดับ", key: "rank", width: 8 },
        { header: "รหัส", key: "code", width: 10 },
        { header: "ชื่อ-สกุล", key: "name", width: 32 },
        { header: "ขาดงาน (วัน)", key: "absent", width: 13 },
        { header: "มาสาย (วัน)", key: "late", width: 12 },
        { header: "ลา (วัน)", key: "leave", width: 10 },
        { header: "มาทำงาน (วัน)", key: "present", width: 14 },
        { header: "วันทำงานตามกำหนด", key: "scheduled", width: 18 },
        { header: "% มาทำงาน", key: "rate", width: 12 },
        { header: "หมายเหตุ", key: "note", width: 44 },
      ];
      sheet.getRow(1).font = { bold: true };
      for (const r of ranked) sheet.addRow({ ...r, rank: r.rank ?? "-" });
      sheet.views = [{ state: "frozen", ySplit: 1 }];
    }
    await addExcelSheet(wb, "รายงานเต็ม", result);
  }

  const fileName = `สรุป-${fileTag}.xlsx`;
  await downloadWorkbook(wb, fileName);
  return fileName;
}
