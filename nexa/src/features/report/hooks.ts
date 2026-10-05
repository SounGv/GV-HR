"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { fetchReport, type ReportParams } from "./api";

export function useReport(params: ReportParams) {
  return useQuery({
    queryKey: ["reports", params],
    queryFn: () => fetchReport(params),
    placeholderData: (prev) => prev,
  });
}

/** One query per selected report type (the "หัวข้อรายงาน" multi-select) —
 * each type's data has its own shape/columns, so there's no single combined
 * query to run; report-view.tsx renders one table section per result
 * instead. Every type shares the same non-type filters (date range,
 * employee/branch/cost-center picks). */
export function useReports(paramsList: ReportParams[]) {
  return useQueries({
    queries: paramsList.map((params) => ({
      queryKey: ["reports", params],
      queryFn: () => fetchReport(params),
      placeholderData: (prev: Awaited<ReturnType<typeof fetchReport>> | undefined) => prev,
    })),
  });
}
