export type AttendanceCorrectionStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type AttendanceCorrectionScope = "me" | "team" | "all";

export interface AttendanceCorrectionRequest {
  id: string;
  workDate: string;
  requestedClockIn: string | null;
  requestedClockOut: string | null;
  reason: string;
  status: AttendanceCorrectionStatus;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

export interface AttendanceCorrectionFormValues {
  workDate: string;
  requestedClockIn?: string;
  requestedClockOut?: string;
  reason: string;
}
