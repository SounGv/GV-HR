export type RaterType = "SELF" | "MANAGER";

export interface ScheduleTemplateCompetency {
  competencyId: string;
  name: string;
  weight: number;
}

export interface ScheduleTemplateListItem {
  id: string;
  name: string;
  active: boolean;
  department: { id: string; name: string };
  intervalMonths: number;
  durationDays: number;
  raterTypes: RaterType[];
  nextRunAt: string;
  lastRunAt: string | null;
  lastGeneratedCampaign: { id: string; name: string } | null;
  evaluationTemplate: { id: string; name: string } | null;
}

export interface ScheduleTemplateDetail extends ScheduleTemplateListItem {
  competencies: ScheduleTemplateCompetency[];
}

export interface ScheduleTemplateFormValues {
  name: string;
  departmentId: string;
  intervalMonths: number;
  durationDays: number;
  raterTypes: RaterType[];
  nextRunAt: string;
  active?: boolean;
  evaluationTemplateId?: string;
  competencies?: { competencyId: string; weight: number }[];
}
