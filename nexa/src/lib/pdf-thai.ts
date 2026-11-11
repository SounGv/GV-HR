import type { jsPDF } from "jspdf";
import { splitStackedMarks } from "./thai-marks";

/** How far marks move, as a share of the font size (tuned on Anuphan). */
export const RAISE_EM = 0.24;
export const SHIFT_LEFT_EM = 0.13;

type Align = "left" | "right" | "center";

function em(doc: jsPDF): number {
  return doc.getFontSize() / doc.internal.scaleFactor;
}

/**
 * Draws the marks that splitStackedMarks() took out of `line`, given where
 * the base text was drawn (same x, y, alignment and baseline as that call).
 */
function drawMarks(doc: jsPDF, line: string, x: number, y: number, align: Align, baseline: "top" | "alphabetic") {
  const { base, marks } = splitStackedMarks(line);
  if (marks.length === 0) return;
  const width = doc.getTextWidth(base);
  const left = align === "right" ? x - width : align === "center" ? x - width / 2 : x;
  const size = em(doc);
  for (const m of marks) {
    const mx = left + doc.getTextWidth(base.slice(0, m.at)) - (m.shiftLeft ? SHIFT_LEFT_EM * size : 0);
    const my = y - (m.raise ? RAISE_EM * size : 0);
    doc.text(m.mark, mx, my, { baseline });
  }
}

/**
 * doc.text() for Thai: prints the line with its stacked tone marks placed
 * where they belong instead of hidden behind vowels and tall consonants.
 */
export function drawThaiText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  opts: { align?: Align; baseline?: "top" | "alphabetic" } = {},
) {
  const align = opts.align ?? "left";
  const baseline = opts.baseline ?? "alphabetic";
  const lines = text.split("\n");
  const lineHeight = em(doc) * doc.getLineHeightFactor();
  lines.forEach((line, i) => {
    const ly = y + i * lineHeight;
    doc.text(splitStackedMarks(line).base, x, ly, { align, baseline });
    drawMarks(doc, line, x, ly, align, baseline);
  });
}

/** The bits of a jspdf-autotable cell the hooks below read and write. */
interface HookCell {
  text: string[];
  styles: { halign?: string; fontSize: number; lineHeight?: number };
  getTextPos(): { x: number; y: number };
}
type HookData = { cell: HookCell; doc?: jsPDF };

/**
 * jspdf-autotable hooks that apply the same fix to every table cell:
 * autotable prints each wrapped line without the lifted marks, then the
 * marks are drawn on top at the matching line positions.
 */
export function thaiTableHooks(doc: jsPDF) {
  const original = new WeakMap<HookCell, string[]>();
  return {
    willDrawCell(data: HookData) {
      const lines = data.cell.text;
      original.set(data.cell, lines);
      data.cell.text = lines.map((l) => splitStackedMarks(l).base);
    },
    didDrawCell(data: HookData) {
      const lines = original.get(data.cell);
      if (!lines) return;
      const { x, y } = data.cell.getTextPos();
      const align = (data.cell.styles.halign as Align) ?? "left";
      const prevSize = doc.getFontSize();
      doc.setFontSize(data.cell.styles.fontSize);
      const lineHeight = em(doc) * doc.getLineHeightFactor();
      lines.forEach((line, i) => drawMarks(doc, line, x, y + i * lineHeight, align, "top"));
      doc.setFontSize(prevSize);
    },
  };
}
