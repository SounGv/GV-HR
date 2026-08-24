"use client";

import { useRef, useState } from "react";
import { Upload, FileDown, CheckCircle2, AlertTriangle, Loader2, ArrowDownToLine, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApiError, type Envelope } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { parseCsv, normHeader } from "@/lib/csv-import";

export interface ImportSummary {
  created: number;
  updated: number;
  total: number;
  errors: { row: number; code: string; message: string }[];
  warnings: string[];
}

interface PreviewRow {
  data: Record<string, string>;
  error: string | null;
}

/**
 * Shared CSV import wizard shell (upload → validated preview → run → summary),
 * proven in the original Employee Import — parameterized here so every other
 * Import Center tab (payroll, attendance, KPI, performance) reuses the exact
 * same UX instead of re-implementing it.
 */
export function GenericImportCenter({
  description,
  columns,
  columnLabels,
  headerAliases,
  requiredColumns,
  validateRow,
  templateHeaders,
  templateSample,
  templateFilename,
  onImport,
  onSuccess,
}: {
  description: string;
  columns: string[];
  columnLabels: Record<string, string>;
  headerAliases: Record<string, string>;
  requiredColumns: string[];
  /** Returns an error message, or null if the row is valid. `seen` accumulates a natural key for duplicate detection across rows. */
  validateRow: (data: Record<string, string>, seen: Set<string>) => string | null;
  templateHeaders: string;
  templateSample: string;
  templateFilename: string;
  onImport: (rows: Record<string, string>[]) => Promise<Envelope<ImportSummary>>;
  onSuccess?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pending, setPending] = useState(false);

  function downloadTemplate() {
    const blob = new Blob(["﻿" + templateHeaders + "\n" + templateSample + "\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = templateFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setSummary(null);
    setFileName(file.name);
    const text = await file.text();
    const grid = parseCsv(text);
    if (grid.length < 2) {
      toast.error("ไฟล์ว่างหรือไม่มีข้อมูล");
      setRows(null);
      return;
    }
    const headerCells = grid[0].map(normHeader);
    const colMap = headerCells.map((h) => headerAliases[h] ?? null);
    const missing = requiredColumns.filter((c) => !colMap.includes(c));
    if (missing.length > 0) {
      toast.error(`ไม่พบคอลัมน์ ${missing.map((c) => columnLabels[c] ?? c).join(", ")} — ใช้เทมเพลตที่ให้`);
      setRows(null);
      return;
    }

    const seen = new Set<string>();
    const preview: PreviewRow[] = grid.slice(1).map((cells) => {
      const data: Record<string, string> = {};
      colMap.forEach((key, i) => {
        if (key) data[key] = (cells[i] ?? "").trim();
      });
      const error = validateRow(data, seen);
      return { data, error };
    });
    setRows(preview);
  }

  async function runImport() {
    if (!rows) return;
    const valid = rows.filter((r) => !r.error).map((r) => r.data);
    if (valid.length === 0) {
      toast.error("ไม่มีแถวที่ถูกต้องให้นำเข้า");
      return;
    }
    setPending(true);
    try {
      const res = await onImport(valid);
      setSummary(res.data);
      toast.success(`นำเข้าสำเร็จ: เพิ่ม ${res.data.created} · อัปเดต ${res.data.updated}`);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "นำเข้าไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  const validCount = rows?.filter((r) => !r.error).length ?? 0;
  const errorCount = rows?.filter((r) => r.error).length ?? 0;

  return (
    <div className="space-y-5">
      {/* Step 1: upload */}
      <Card className="gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">อัปโหลดไฟล์ CSV</h2>
            <p className="text-xs text-muted-foreground">{description} (Excel ให้ Save As CSV UTF-8)</p>
          </div>
          <Button variant="outline" onClick={downloadTemplate}>
            <FileDown className="size-4" /> ดาวน์โหลดเทมเพลต
          </Button>
        </div>

        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 py-8 text-center transition hover:border-primary/40"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">{fileName || "คลิกเพื่อเลือกไฟล์ .csv"}</p>
          <p className="text-xs text-muted-foreground">รองรับไฟล์ CSV (UTF-8)</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </Card>

      {/* Step 2: preview */}
      {rows && (
        <Card className="gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 font-medium text-success">
                <CheckCircle2 className="size-4" /> พร้อมนำเข้า {validCount}
              </span>
              {errorCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 font-medium text-destructive">
                  <AlertTriangle className="size-4" /> ผิดพลาด {errorCount}
                </span>
              )}
            </div>
            <Button onClick={runImport} disabled={pending || validCount === 0}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />}
              นำเข้า {validCount} รายการ
            </Button>
          </div>

          <div className="max-h-[420px] overflow-auto rounded-lg border border-border">
            <table className="w-full text-[15px]">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="text-left">
                  <th className="px-2 py-2 text-xs font-medium text-muted-foreground">สถานะ</th>
                  {columns.map((c) => (
                    <th key={c} className="px-2 py-2 text-xs font-medium text-muted-foreground">
                      {columnLabels[c] ?? c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={cn("border-t border-border", r.error && "bg-destructive/5")}>
                    <td className="px-2 py-1.5">
                      {r.error ? (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive" title={r.error}>
                          <XCircle className="size-3.5" /> {r.error}
                        </span>
                      ) : (
                        <CheckCircle2 className="size-4 text-success" />
                      )}
                    </td>
                    {columns.map((c) => (
                      <td key={c} className="max-w-[160px] truncate px-2 py-1.5" title={r.data[c] ?? ""}>
                        {r.data[c] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Step 3: summary */}
      {summary && (
        <Card className="gap-3 border-success/30 bg-success/5 p-5">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <CheckCircle2 className="size-5 text-success" /> นำเข้าเสร็จสิ้น
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="เพิ่มใหม่" value={summary.created} />
            <Stat label="อัปเดต" value={summary.updated} />
            <Stat label="ข้าม/ผิดพลาด" value={summary.errors.length} />
          </div>
          {summary.warnings.length > 0 && (
            <div className="rounded-lg bg-warning/10 p-3 text-xs text-warning">
              <p className="mb-1 font-medium">คำเตือน ({summary.warnings.length})</p>
              <ul className="list-inside list-disc space-y-0.5">
                {summary.warnings.slice(0, 20).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {summary.errors.length > 0 && (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              <p className="mb-1 font-medium">รายการที่ผิดพลาด</p>
              <ul className="list-inside list-disc space-y-0.5">
                {summary.errors.slice(0, 20).map((e, i) => (
                  <li key={i}>แถว {e.row} ({e.code}): {e.message}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-background/60 py-3">
      <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
