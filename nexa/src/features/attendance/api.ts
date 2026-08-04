import { api, type Envelope } from "@/lib/api/client";
import type { AttendanceRecord, AttendanceScope, ClockPayload } from "./types";

export function fetchToday() {
  return api.get<Envelope<AttendanceRecord | null>>("/api/attendance/today");
}

export function fetchAttendance(scope: AttendanceScope, from?: string, to?: string) {
  const params = new URLSearchParams({ scope });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return api.get<Envelope<AttendanceRecord[]>>(`/api/attendance?${params.toString()}`);
}

export function clockIn(payload: ClockPayload) {
  return api.post<Envelope<AttendanceRecord>>("/api/attendance/clock-in", payload);
}

export function clockOut(payload: ClockPayload) {
  return api.post<Envelope<AttendanceRecord>>("/api/attendance/clock-out", payload);
}

export function startBreak() {
  return api.post<Envelope<AttendanceRecord>>("/api/attendance/break/start");
}

export function endBreak() {
  return api.post<Envelope<AttendanceRecord>>("/api/attendance/break/end");
}
