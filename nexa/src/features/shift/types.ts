export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  breakMinutes: number;
}

export interface ShiftAssignment {
  id: string;
  date: string; // YYYY-MM-DD
  employeeId: string;
  note: string | null;
  template: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    color: string;
  };
}

export interface TemplateFormValues {
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  breakMinutes: string;
}

export type SwapRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface SwapRequestPerson {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface SwapRequest {
  id: string;
  status: SwapRequestStatus;
  reason: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  assignment: {
    id: string;
    date: string;
    template: { id: string; name: string; startTime: string; endTime: string; color: string };
  };
  requesterEmployee: SwapRequestPerson;
  targetEmployee: SwapRequestPerson;
}
