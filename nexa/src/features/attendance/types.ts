export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "ON_LEAVE";
export type AttendanceWorkMode = "ONSITE" | "WFH" | "OUTSIDE";
export type AttendanceMood = "TERRIBLE" | "BAD" | "OK" | "GOOD" | "EXCELLENT";

export interface AttendanceRecord {
  id: string;
  workDate: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockInLat: number | null;
  clockInLng: number | null;
  clockOutLat: number | null;
  clockOutLng: number | null;
  clockInDistance: number | null;
  clockOutDistance: number | null;
  clockInPhotoUrl: string | null;
  clockOutPhotoUrl: string | null;
  clockInViaQr: boolean;
  clockOutViaQr: boolean;
  breakStartAt: string | null;
  breakEndAt: string | null;
  workMode: AttendanceWorkMode;
  moodOut: AttendanceMood | null;
  earlyLeaveOut: boolean;
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

export interface BranchGeofence {
  name: string;
  lat: number | null;
  lng: number | null;
  radiusMeters: number | null;
}

export interface TodayResponse {
  record: AttendanceRecord | null;
  branch: BranchGeofence | null;
}

export interface ClockPayload {
  lat?: number;
  lng?: number;
  accuracy?: number;
  photo?: string;
  device?: string;
  offsiteReason?: string;
  workMode?: AttendanceWorkMode;
  mood?: AttendanceMood;
  qrBranchId?: string;
}
