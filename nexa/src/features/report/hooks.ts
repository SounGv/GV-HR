"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchReport } from "./api";
import type { ReportType } from "./schema";

export function useReport(type: ReportType, period?: string) {
  return useQuery({
    queryKey: ["reports", type, period],
    queryFn: () => fetchReport(type, period),
    placeholderData: (prev) => prev,
  });
}
