"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchReport, type ReportParams } from "./api";

export function useReport(params: ReportParams) {
  return useQuery({
    queryKey: ["reports", params],
    queryFn: () => fetchReport(params),
    placeholderData: (prev) => prev,
  });
}
