"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createHoliday,
  deleteHoliday,
  fetchHolidays,
  updateHoliday,
} from "./api";
import type { HolidayFormValues } from "./types";

export const holidayKeys = {
  all: ["holidays"] as const,
  list: (year: number) => ["holidays", "list", year] as const,
};

export function useHolidays(year: number) {
  return useQuery({
    queryKey: holidayKeys.list(year),
    queryFn: () => fetchHolidays(year),
    placeholderData: (prev) => prev,
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HolidayFormValues) => createHoliday(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: holidayKeys.all }),
  });
}

export function useUpdateHoliday(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<HolidayFormValues>) => updateHoliday(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: holidayKeys.all }),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteHoliday(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: holidayKeys.all }),
  });
}
