import { Card } from "@/components/ui/card";
import { PhotoCell } from "./report-photo-cell";
import type { ReportResult } from "./types";

// Naive but low-risk: report status text is always Thai and drawn from a
// small, known vocabulary (see ATTENDANCE_STATUS_LABEL/EXPENSE_STATUS_LABEL/
// etc. in report/service.ts) — matching by substring is enough to color the
// dot without needing per-report-type config here.
const POSITIVE_WORDS = ["อนุมัติแล้ว", "มาทำงาน", "จ่ายแล้ว", "เรียบร้อย"];
const NEGATIVE_WORDS = ["รอ", "ไม่อนุมัติ", "มาสาย", "ขาดงาน", "ยกเลิก", "ปฏิเสธ", "ติดลบ"];

function statusTone(value: string): "positive" | "negative" | "neutral" {
  if (POSITIVE_WORDS.some((w) => value.includes(w))) return "positive";
  if (NEGATIVE_WORDS.some((w) => value.includes(w))) return "negative";
  return "neutral";
}

function fmtNum(v: string | number | undefined) {
  if (v == null) return "-";
  return typeof v === "number" ? v.toLocaleString("th-TH") : v;
}

// Whichever of these a report's columns happen to include become the card's
// header/subheader — the rest render as label:value rows below. Every
// report type shares this same generic layout instead of one hand-built
// card per report type.
const HEADER_KEYS = ["name", "code"];
const SUBHEADER_KEYS = ["date", "status"];

/**
 * Mobile-only (md:hidden) card list — the report table's alternative to
 * horizontal scrolling on narrow screens. Purely a different rendering of
 * the same result.columns/result.rows the desktop <Table> already uses.
 */
export function ReportMobileCards({
  result,
  onOpenPhoto,
}: {
  result: ReportResult;
  onOpenPhoto: (url: string) => void;
}) {
  const headerCols = result.columns.filter((c) => HEADER_KEYS.includes(c.key));
  const subheaderCols = result.columns.filter((c) => SUBHEADER_KEYS.includes(c.key));
  const usedKeys = new Set([...headerCols, ...subheaderCols].map((c) => c.key));
  const bodyCols = result.columns.filter((c) => !usedKeys.has(c.key));

  return (
    <div className="space-y-3 md:hidden print:hidden">
      {result.rows.map((row, i) => (
        <Card key={i} className="gap-0 overflow-hidden p-0">
          {(headerCols.length > 0 || subheaderCols.length > 0) && (
            <div className="space-y-1 border-b border-border bg-muted/40 px-4 py-3">
              {headerCols.length > 0 && (
                <div className="flex items-center justify-between gap-2">
                  {headerCols.map((c) => (
                    <span
                      key={c.key}
                      className={c.key === "name" ? "font-semibold text-foreground" : "text-sm text-muted-foreground"}
                    >
                      {row[c.key]}
                    </span>
                  ))}
                </div>
              )}
              {subheaderCols.length > 0 && (
                <div className="flex items-center justify-between gap-2 text-sm">
                  {subheaderCols.map((c) => {
                    if (c.key !== "status") {
                      return (
                        <span key={c.key} className="text-muted-foreground">
                          {row[c.key]}
                        </span>
                      );
                    }
                    const tone = statusTone(String(row[c.key] ?? ""));
                    return (
                      <span key={c.key} className="flex items-center gap-1.5 font-medium">
                        <span
                          className={
                            "size-2 rounded-full " +
                            (tone === "positive" ? "bg-emerald-500" : tone === "negative" ? "bg-amber-500" : "bg-muted-foreground")
                          }
                        />
                        {row[c.key]}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <dl className="divide-y divide-border">
            {bodyCols.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <dt className="text-muted-foreground">{c.label}</dt>
                <dd className={c.numeric ? "text-right font-medium tabular-nums" : "text-right font-medium"}>
                  {c.photo ? <PhotoCell url={row[c.key]} onOpen={onOpenPhoto} /> : fmtNum(row[c.key])}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}
    </div>
  );
}
