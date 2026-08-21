export type GoalStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "AT_RISK"
  | "COMPLETED"
  | "CANCELLED";
export type GoalType = "KPI" | "OKR";
export type GoalScope = "me" | "team" | "all";

export interface KeyResultSummary {
  id: string;
  title: string;
  unit: string;
  targetValue: number;
  currentValue: number;
  weight: number;
  status: GoalStatus;
}

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  type: GoalType;
  cycle: string;
  unit: string;
  targetValue: number;
  currentValue: number;
  weight: number;
  status: GoalStatus;
  dueDate: string | null;
  createdAt: string;
  parentGoalId: string | null;
  keyResults: KeyResultSummary[];
  rollup: { percent: number; status: GoalStatus } | null;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

export interface GoalFormValues {
  employeeId: string;
  parentGoalId?: string;
  title: string;
  description?: string;
  type: GoalType;
  cycle: string;
  unit: string;
  targetValue: string;
  currentValue: string;
  weight: string;
  status: GoalStatus;
  dueDate?: string;
}
