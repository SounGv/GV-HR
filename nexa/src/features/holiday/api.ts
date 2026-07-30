import { api, type Envelope } from "@/lib/api/client";
import type { Holiday, HolidayFormValues } from "./types";

export function fetchHolidays(year: number) {
  return api.get<Envelope<Holiday[]>>(`/api/holidays?year=${year}`);
}

export function createHoliday(input: HolidayFormValues) {
  return api.post<Envelope<Holiday>>("/api/holidays", input);
}

export function updateHoliday(id: string, input: Partial<HolidayFormValues>) {
  return api.patch<Envelope<Holiday>>(`/api/holidays/${id}`, input);
}

export function deleteHoliday(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/holidays/${id}`);
}
