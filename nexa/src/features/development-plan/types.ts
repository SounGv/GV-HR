export type DevelopmentItemStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
export type DevelopmentPlanStatus = "ACTIVE" | "COMPLETED";

export interface ProgressNote {
  at: string;
  note: string;
}

export interface DevelopmentItem {
  id: string;
  title: string;
  description: string | null;
  method: string | null;
  targetDate: string | null;
  status: DevelopmentItemStatus;
  progressNotes: ProgressNote[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface DevelopmentPlan {
  id: string;
  cycle: string;
  status: DevelopmentPlanStatus;
  employeeId: string;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    managerId: string | null;
  };
  items: DevelopmentItem[];
}

export interface GapSuggestion {
  title: string;
  score: number;
  sourceCycle: string;
}

export interface DevelopmentItemFormValues {
  title: string;
  description?: string;
  method?: string;
  targetDate?: string;
}
