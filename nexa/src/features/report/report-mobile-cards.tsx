import { Card } from "@/components/ui/card";
import { PhotoCell, type PhotoPreview } from "./report-photo-cell";
import { ReportStatusBadge, dailyCardClass, dailyPhotoPreview, type DisplayColumn } from "./attendance-row-style";
import { cn } from "@/lib/utils";
import { columnLabel, type ReportResult } from "./types";

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
function photoMeta(row: Record<string, string | number>, key: string) {
  const { title, lines } = dailyPhotoPreview(row, key, "");
  return { title, lines };
}

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
  columns,
  isDaily = false,
  onOpenName,
}: {
  result: ReportResult;
  onOpenPhoto: (photo: PhotoPreview) => void;
  /** Columns to show (daily report: main set, plus extras when toggled). Defaults to every column. */
  columns?: DisplayColumn[];
  /** Daily attendance report: tint each card by status and read the status from `statusKey`. */
  isDaily?: boolean;
  /** When set, the name in each card becomes a button (leave report: opens that person's year). */
  onOpenName?: (row: Record<string, string | number>) => void;
}) {
  const all: DisplayColumn[] = columns ?? result.columns;
  const headerCols = all.filter((c) => HEADER_KEYS.includes(c.key));
  const subheaderCols = all.filter((c) => SUBHEADER_KEYS.includes(c.key));
  const usedKeys = new Set([...headerCols, ...subheaderCols].map((c) => c.key));
  const bodyCols = all.filter((c) => !usedKeys.has(c.key));

  return (
    <div className="space-y-3 md:hidden">
      {result.rows.map((row, i) => {
        const tone = isDaily ? dailyCardClass(row) : {};
        return (
        <Card key={i} className={cn("gap-0 overflow-hidden p-0", tone.card)}>
          {(headerCols.length > 0 || subheaderCols.length > 0) && (
            <div className={cn("space-y-1 border-b border-border bg-muted/40 px-4 py-3", tone.header)}>
              {headerCols.length > 0 && (
                <div className="flex items-center justify-between gap-2">
                  {headerCols.map((c) =>
                    c.key === "name" && onOpenName ? (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => onOpenName(row)}
                        className="min-h-11 text-left font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        {row[c.key]}
                      </button>
                    ) : (
                      <span
                        key={c.key}
                        className={c.key === "name" ? "font-semibold text-foreground" : "text-sm text-muted-foreground"}
                      >
                        {row[c.key]}
                      </span>
                    ),
                  )}
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
                    if (isDaily && row.statusKey) {
                      return <ReportStatusBadge key={c.key} statusKey={String(row.statusKey)} />;
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
                <dt className="text-muted-foreground">{columnLabel(c)}</dt>
                <dd className={c.numeric ? "text-right font-medium tabular-nums" : "text-right font-medium"}>
                  {c.photo ? (
                    <PhotoCell
                      url={row[c.key]}
                      onOpen={onOpenPhoto}
                      {...(isDaily ? photoMeta(row, c.key) : {})}
                    />
                  ) : (
                    fmtNum(c.value ? c.value(row) : row[c.key])
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
        );
      })}
    </div>
  );
}
