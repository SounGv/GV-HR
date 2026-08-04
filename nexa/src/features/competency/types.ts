export interface Competency {
  id: string;
  name: string;
  description: string | null;
  exampleBehavior: string | null;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  order: number;
  active: boolean;
  createdAt: string;
}

export interface CompetencyFormValues {
  name: string;
  description?: string;
  exampleBehavior?: string;
  categoryId?: string | null;
  order?: number;
  active?: boolean;
}
