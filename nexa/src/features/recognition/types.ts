export type RecognitionType = "STAR" | "AWARD" | "HEART" | "POINT";
export type RecognitionScope = "me" | "team" | "all";

export interface Recognition {
  id: string;
  type: RecognitionType;
  points: number;
  message: string | null;
  createdAt: string;
  givenByEmployeeId: string | null;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

export interface RecognitionSummary {
  star: number;
  award: number;
  heart: number;
  point: number;
}

export interface RecognitionFormValues {
  employeeId: string;
  type: RecognitionType;
  points?: number;
  message?: string;
}
