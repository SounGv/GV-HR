export type ReviewStatus = "DRAFT" | "FINALIZED";
export type ReviewScope = "me" | "team" | "all";

export interface Competency {
  name: string;
  score: number;
}

export interface PerformanceReview {
  id: string;
  cycle: string;
  overallScore: number;
  band: string;
  competencies: Competency[];
  strengths: string | null;
  improvements: string | null;
  summary: string | null;
  status: ReviewStatus;
  createdAt: string;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    managerId: string | null;
  };
}

export interface ReviewFormValues {
  employeeId: string;
  cycle: string;
  competencies: Competency[];
  strengths?: string;
  improvements?: string;
  summary?: string;
}
