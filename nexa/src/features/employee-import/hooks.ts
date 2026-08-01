"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { importEmployeesApi } from "./api";

export function useImportEmployees() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Record<string, unknown>[]) => importEmployeesApi(rows),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}
