export interface ReportColumn {
  key: string;
  label: string;
  numeric?: boolean;
  /** Heading shared by neighbouring columns (e.g. "ลาป่วย" over สิทธิ์ / ใช้ไปแล้ว / คงเหลือ). The table draws it as a top
   * row; exports and phone cards show it as a prefix so each column stays self-explanatory. */
  group?: string;
  /** Cell value is an image URL (or "-") — render as a clickable thumbnail
   * instead of raw text/link. Currently only the daily attendance report's
   * clock-in/out photo columns. */
  photo?: boolean;
}

export interface ReportSummaryDatum {
  label: string;
  value: number;
}

export interface ReportResult {
  title: string;
  period: string | null;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  /** Optional department-level rollup of the report's primary metric, for the chart. */
  summary?: ReportSummaryDatum[];
  summaryLabel?: string;
  summaryUnit?: string;
  /** Second chart, currently only populated by the payroll report (SSO/withholding-tax totals to remit). */
  secondarySummary?: ReportSummaryDatum[];
  secondarySummaryLabel?: string;
  secondarySummaryUnit?: string;
  /** Totals/averages line shown under the table, replacing the generic "รวม N รายการ" when set. */
  footnote?: string;
  /** Calendar year the report covers (leave report only); the per-person panel loads the same year. */
  year?: number;
  /** Set when the report had more rows than it can return: it is complete only from this day on (YYYY-MM-DD). */
  truncatedFrom?: string;
}

/** Full name of a column outside the grouped table: "ลาป่วย สิทธิ์ (วัน)". */
export const columnLabel = (c: { group?: string; label: string }) => (c.group ? `${c.group} ${c.label}` : c.label);
