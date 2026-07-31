interface Column {
  key: string;
  label: string;
}

function escapeCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV string from column definitions and row objects. */
export function toCsv(columns: Column[], rows: Record<string, unknown>[]): string {
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => escapeCell(r[c.key])).join(",")).join("\n");
  return `${header}\n${body}`;
}

/** Trigger a browser download of CSV text (UTF-8 BOM for Excel/Thai). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
