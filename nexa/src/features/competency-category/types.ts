export interface CompetencyCategory {
  id: string;
  name: string;
  order: number;
  createdAt: string;
}

export interface CompetencyCategoryFormValues {
  name: string;
  order?: number;
}
