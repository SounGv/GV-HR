export type LeaveType = "ANNUAL" | "SICK" | "PERSONAL" | "UNPAID" | "OTHER" | "HOLIDAY_SWAP";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type LeaveScope = "me" | "team" | "all";
export type LeaveUnit = "DAY" | "HOUR";

export interface LeaveRequest {
  id: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  days: number;
  unit: LeaveUnit;
  hours: number | null;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  attachmentUrl: string | null;
  status: LeaveStatus;
  approverEmployeeId: string | null;
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

export interface LeaveBalance {
  id: string;
  type: LeaveType;
  year: number;
  totalDays: number;
  usedDays: number;
  totalHours: number;
  usedHours: number;
  /** False when totalDays is just the historical system fallback (10/30/3)
   * because HR hasn't actually configured a real day-quota yet — the UI
   * should hide the number in that case rather than show it as policy. */
  daysConfigured: boolean;
}

export interface LeaveFormValues {
  type: LeaveType;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  unit?: LeaveUnit;
  startTime?: string;
  endTime?: string;
  reason?: string;
  attachmentUrl?: string;
}
