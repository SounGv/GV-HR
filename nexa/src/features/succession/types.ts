export type SuccessionReadiness = "READY_NOW" | "ONE_TO_TWO_YEARS" | "THREE_TO_FIVE_YEARS" | "NOT_READY";

export interface EmployeeRef {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface SuccessionCandidate {
  id: string;
  readiness: SuccessionReadiness;
  note: string | null;
  rank: number | null;
  employee: EmployeeRef;
}

export interface SuccessionPlanListItem {
  id: string;
  notes: string | null;
  createdAt: string;
  position: { id: string; title: string; code: string };
  incumbentEmployee: EmployeeRef | null;
  candidateCount: number;
}

export interface SuccessionPlanDetail {
  id: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  position: { id: string; title: string; code: string };
  incumbentEmployee: EmployeeRef | null;
  candidates: SuccessionCandidate[];
}

export interface PlanFormValues {
  positionId: string;
  incumbentEmployeeId?: string;
  notes?: string;
}
