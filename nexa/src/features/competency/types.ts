export type QuestionType =
  | "RATING_1_TO_5"
  | "PERCENTAGE"
  | "NUMERIC_TARGET"
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "YES_NO"
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "FILE_EVIDENCE";

export interface Competency {
  id: string;
  name: string;
  description: string | null;
  exampleBehavior: string | null;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  order: number;
  active: boolean;
  questionType: QuestionType;
  maxScore: number;
  defaultWeight: number;
  departmentId: string | null;
  positionId: string | null;
  evaluationType: string | null;
  isRequired: boolean;
  /** How many templates currently reference this bank item — "used in N
   * templates" hint in the list view. */
  usageCount: number;
  createdAt: string;
}

export interface CompetencyFormValues {
  name: string;
  description?: string;
  exampleBehavior?: string;
  categoryId?: string | null;
  order?: number;
  active?: boolean;
  questionType?: QuestionType;
  maxScore?: number;
  defaultWeight?: number;
  departmentId?: string | null;
  positionId?: string | null;
  evaluationType?: string | null;
  isRequired?: boolean;
}
