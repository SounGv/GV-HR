export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "ON_LEAVE";

export interface AttendanceRecord {
  id: string;
  workDate: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockInDistance: number | null;
  clockOutDistance: number | null;
  status: AttendanceStatus;
  note: string | null;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

export type AttendanceScope = "me" | "team" | "all";

export interface ClockPayload {
  lat?: number;
  lng?: number;
  accuracy?: number;
}
