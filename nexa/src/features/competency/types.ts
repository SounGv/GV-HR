export interface Competency {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
}

export interface CompetencyFormValues {
  name: string;
  description?: string;
  active?: boolean;
}
