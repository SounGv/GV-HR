export interface ReportColumn {
  key: string;
  label: string;
  numeric?: boolean;
}

export interface ReportResult {
  title: string;
  period: string | null;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
}
