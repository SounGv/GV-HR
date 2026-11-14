import type Anthropic from "@anthropic-ai/sdk";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import {
  base64Bytes,
  checkFiles,
  classifyFile,
  decodeText,
  fileHeader,
  limitText,
  signatureMatches,
  MAX_FILES,
  MAX_TEXT_CHARS,
  MAX_TOTAL_BYTES,
  toCsv,
  type OutputCheck,
} from "@/features/ai/attachments";

/** One file as the browser sends it. */
export interface IncomingFile {
  name: string;
  data: string; // base64, no data: prefix
}

export type BuiltAttachments = { ok: true; blocks: Anthropic.ContentBlockParam[]; names: string[] } | { ok: false; message: string };

/** Decodes base64 into bytes. */
const bytesOf = (b64: string) => new Uint8Array(Buffer.from(b64, "base64"));

/** Every sheet of an Excel file as CSV text under its name. */
function sheetsToText(bytes: Uint8Array): string {
  const wb = XLSX.read(bytes, { type: "array", cellDates: true });
  return wb.SheetNames.map((n) => `### แผ่นงาน: ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false })}`).join("\n\n");
}

/**
 * Turns the attached files into message content for the model, checking sizes and kinds again here (the browser
 * is not trusted). PDF and pictures are passed as they are; Excel, CSV and text become text, cut at a limit.
 * Nothing is saved anywhere.
 */
export function buildAttachmentBlocks(files: IncomingFile[]): BuiltAttachments {
  if (files.length === 0) return { ok: true, blocks: [], names: [] };
  if (files.length > MAX_FILES) return { ok: false, message: `แนบได้ไม่เกิน ${MAX_FILES} ไฟล์` };
  const sizes = files.map((f) => ({ name: f.name, size: base64Bytes(f.data) }));
  const check = checkFiles(sizes);
  if (!check.ok) return { ok: false, message: check.problems.join(" ") };
  if (sizes.reduce((s, f) => s + f.size, 0) > MAX_TOTAL_BYTES) return { ok: false, message: "ไฟล์ใหญ่เกินที่แนบได้" };

  const blocks: Anthropic.ContentBlockParam[] = [];
  let textBudget = MAX_TEXT_CHARS;
  for (const f of files) {
    const c = classifyFile(f.name);
    if (!c.ok) return { ok: false, message: c.message };
    if (!signatureMatches(f.name, bytesOf(f.data).subarray(0, 16))) {
      return { ok: false, message: `ไฟล์ "${f.name}" ไม่ใช่ไฟล์ชนิดที่ชื่อบอก หรือไฟล์เสีย ลองเปิดไฟล์ด้วยโปรแกรมของมันแล้วบันทึกใหม่` };
    }
    if (c.kind === "pdf") {
      blocks.push({ type: "text", text: fileHeader(f.name, "pdf") });
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data } });
    } else if (c.kind === "image") {
      blocks.push({ type: "text", text: fileHeader(f.name, "image") });
      blocks.push({ type: "image", source: { type: "base64", media_type: c.imageMime!, data: f.data } });
    } else {
      let raw: string;
      try {
        raw = c.kind === "sheet" ? sheetsToText(bytesOf(f.data)) : decodeText(bytesOf(f.data));
      } catch {
        return { ok: false, message: `อ่านไฟล์ "${f.name}" ไม่ได้ ไฟล์อาจเสียหรือมีรหัสผ่าน` };
      }
      const cut = limitText(raw, Math.max(0, textBudget));
      textBudget -= cut.text.length;
      const note = cut.cut ? ` (แสดง ${cut.text.length.toLocaleString("en-US")} จาก ${cut.total.toLocaleString("en-US")} ตัวอักษร ที่เหลือถูกตัด ถ้าตัวเลขรวมต้องแม่นให้บอกผู้ใช้ว่าอ่านได้ไม่ครบ)` : "";
      blocks.push({ type: "text", text: `${fileHeader(f.name, c.kind, note.trim())}\n\n${cut.text}` });
    }
  }
  return { ok: true, blocks, names: files.map((f) => f.name) };
}

export interface OutFile {
  name: string;
  mime: string;
  /** base64 */
  data: string;
}

/** The file the assistant hands back, built here (nothing is stored). */
export async function buildOutputFile(check: Extract<OutputCheck, { ok: true }>): Promise<OutFile> {
  if (check.format === "csv") {
    return { name: check.fileName, mime: "text/csv", data: Buffer.from(toCsv(check.sheets[0].rows), "utf-8").toString("base64") };
  }
  const wb = new ExcelJS.Workbook();
  wb.creator = "น้องวีบอท";
  for (const s of check.sheets) {
    const ws = wb.addWorksheet(s.name);
    ws.addRows(s.rows);
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    const widest = Math.max(0, ...s.rows.map((r) => r.length));
    for (let c = 1; c <= widest; c++) {
      const longest = Math.max(...s.rows.map((r) => String(r[c - 1] ?? "").length));
      ws.getColumn(c).width = Math.min(60, Math.max(10, longest + 2));
    }
  }
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return { name: check.fileName, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", data: buf.toString("base64") };
}
