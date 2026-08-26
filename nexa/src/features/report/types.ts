export interface ReportColumn {
  key: string;
  label: string;
  numeric?: boolean;
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
}
