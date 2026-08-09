import { api, type Envelope } from "@/lib/api/client";
import type {
  AttendanceCorrectionFormValues,
  AttendanceCorrectionRequest,
  AttendanceCorrectionScope,
  AttendanceCorrectionStatus,
} from "./types";

export function fetchAttendanceCorrections(scope: AttendanceCorrectionScope, status?: AttendanceCorrectionStatus) {
  const params = new URLSearchParams({ scope });
  if (status) params.set("status", status);
  return api.get<Envelope<AttendanceCorrectionRequest[]>>(`/api/attendance/corrections?${params.toString()}`);
}

export function createAttendanceCorrection(input: AttendanceCorrectionFormValues) {
  return api.post<Envelope<AttendanceCorrectionRequest>>("/api/attendance/corrections", input);
}

export function decideAttendanceCorrection(id: string, action: "approve" | "reject", note?: string) {
  return api.post<Envelope<AttendanceCorrectionRequest>>(`/api/attendance/corrections/${id}/decide`, {
    action,
    note,
  });
}

export function cancelAttendanceCorrection(id: string) {
  return api.post<Envelope<AttendanceCorrectionRequest>>(`/api/attendance/corrections/${id}/cancel`);
}
