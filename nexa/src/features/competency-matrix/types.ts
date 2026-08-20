export interface CompetencyRequirementRow {
  competencyId: string;
  competencyName: string;
  categoryName: string | null;
  requiredLevel: number | null;
}

export interface EmployeeGapRow extends CompetencyRequirementRow {
  assessedLevel: number | null;
  gap: number | null;
  note: string | null;
  assessedAt: string | null;
}

export interface LevelItem {
  competencyId: string;
  level: number;
  note?: string;
}
