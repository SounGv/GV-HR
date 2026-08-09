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
}
