export type LeaveType = "ANNUAL" | "SICK" | "PERSONAL" | "UNPAID" | "OTHER";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type LeaveScope = "me" | "team" | "all";

export interface LeaveRequest {
  id: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  days: number;
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
}

export interface LeaveFormValues {
  type: LeaveType;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  reason?: string;
  attachmentUrl?: string;
}
