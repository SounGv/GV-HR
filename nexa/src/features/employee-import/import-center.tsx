"use client";

import { useRef, useState } from "react";
import { Upload, FileDown, CheckCircle2, AlertTriangle, Loader2, Users, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { IMPORT_COLUMNS, type ImportColumn, type ImportSummary } from "./schema";
import { useImportEmployees } from "./hooks";

const HEADER_ALIASES: Record<string, ImportColumn> = {
  รหัสพนักงาน: "employeeCode", รหัส: "employeeCode", employeecode: "employeeCode", code: "employeeCode", empcode: "employeeCode",
  ชื่อ: "firstName", firstname: "firstName", name: "firstName",
  นามสกุล: "lastName", lastname: "lastName", surname: "lastName",
  ชื่อเล่น: "nickname", nickname: "nickname",
  อีเมล: "email", email: "email",
  เบอร์โทร: "phone", โทรศัพท์: "phone", โทร: "phone", phone: "phone", tel: "phone",
  แผนก: "department", ฝ่าย: "department", department: "department", dept: "department",
  ตำแหน่ง: "position", position: "position", title: "position",
  เงินเดือน: "baseSalary", salary: "baseSalary", basesalary: "baseSalary",
};

const COLUMN_LABEL: Record<ImportColumn, string> = {
  employeeCode: "รหัส", firstName: "ชื่อ", lastName: "นามสกุล", nickname: "ชื่อเล่น",
  email: "อีเมล", phone: "โทร", department: "แผนก", position: "ตำแหน่ง", baseSalary: "เงินเดือน",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PreviewRow {
  data: Record<string, string>;
  error: string | null;
}

/** Quote-aware CSV parser → array of rows (arrays of cells). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // strip BOM
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "");
}

export function ImportCenter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const importMut = useImportEmployees();
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  function downloadTemplate() {
    const headers = "รหัสพนักงาน,ชื่อ,นามสกุล,ชื่อเล่น,อีเมล,เบอร์โทร,แผนก,ตำแหน่ง,เงินเดือน";
    const sample = "2001,สมชาย,ใจดี,ชาย,somchai@example.com,0812345678,แผนกบัญชี,จนท.ฝ่ายบัญชี,25000";
    const blob = new Blob(["﻿" + headers + "\n" + sample + "\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employee-import-template.csv";
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
    const colMap = headerCells.map((h) => HEADER_ALIASES[h] ?? null);
    if (!colMap.includes("employeeCode") || !colMap.includes("firstName")) {
      toast.error("ไม่พบคอลัมน์ รหัสพนักงาน หรือ ชื่อ — ใช้เทมเพลตที่ให้");
      setRows(null);
      return;
    }

    const seen = new Set<string>();
    const preview: PreviewRow[] = grid.slice(1).map((cells) => {
      const data: Record<string, string> = {};
      colMap.forEach((key, i) => {
        if (key) data[key] = (cells[i] ?? "").trim();
      });
      let error: string | null = null;
      if (!data.employeeCode) error = "ไม่มีรหัสพนักงาน";
      else if (!data.firstName) error = "ไม่มีชื่อ";
      else if (data.email && !EMAIL_RE.test(data.email)) error = "อีเมลไม่ถูกต้อง";
      else if (seen.has(data.employeeCode)) error = "รหัสซ้ำในไฟล์";
      if (data.employeeCode) seen.add(data.employeeCode);
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
    try {
      const res = await importMut.mutateAsync(valid);
      setSummary(res.data);
      toast.success(`นำเข้าสำเร็จ: เพิ่ม ${res.data.created} · อัปเดต ${res.data.updated}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "นำเข้าไม่สำเร็จ");
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
            <p className="text-xs text-muted-foreground">
              คอลัมน์: รหัสพนักงาน, ชื่อ, นามสกุล, ชื่อเล่น, อีเมล, เบอร์โทร, แผนก, ตำแหน่ง, เงินเดือน
              (Excel ให้ Save As CSV UTF-8)
            </p>
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
            <Button onClick={runImport} disabled={importMut.isPending || validCount === 0}>
              {importMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
              นำเข้า {validCount} รายการ
            </Button>
          </div>

          <div className="max-h-[420px] overflow-auto rounded-lg border border-border">
            <table className="w-full text-[15px]">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="text-left">
                  <th className="px-2 py-2 text-xs font-medium text-muted-foreground">สถานะ</th>
                  {IMPORT_COLUMNS.map((c) => (
                    <th key={c} className="px-2 py-2 text-xs font-medium text-muted-foreground">
                      {COLUMN_LABEL[c]}
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
                    {IMPORT_COLUMNS.map((c) => (
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
