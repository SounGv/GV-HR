export type OtStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type OtScope = "me" | "team" | "all";

export interface OvertimeRequest {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  multiplier: number;
  estimatedAmount: number;
  reason: string | null;
  status: OtStatus;
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

export interface OtFormValues {
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
}
