export type CampaignStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export type RaterType = "SELF" | "MANAGER";
export type ResponseStatus = "PENDING" | "SUBMITTED";

export interface CampaignCompetency {
  competencyId: string;
  name: string;
  description: string | null;
  weight: number;
}

export interface CampaignListItem {
  id: string;
  name: string;
  cycle: string;
  startDate: string;
  endDate: string;
  status: CampaignStatus;
  aiGenerated: boolean;
  participantCount: number;
}

export interface CampaignDetail extends CampaignListItem {
  aiRationale: string | null;
  competencies: CampaignCompetency[];
  participants: ParticipantSummary[];
}

export interface ParticipantSummary {
  id: string;
  overallScore: number | null;
  band: string | null;
  finalizedAt: string | null;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    managerId: string | null;
  };
  responses: { raterType: RaterType; status: ResponseStatus; submittedAt: string | null }[];
}

export interface ParticipantDetail extends ParticipantSummary {
  campaign: { id: string; name: string; cycle: string; competencies: CampaignCompetency[] };
  fullResponses: {
    raterType: RaterType;
    raterEmployeeId: string;
    status: ResponseStatus;
    scores: { competencyId: string; score: number }[];
    strengths: string | null;
    improvements: string | null;
    summary: string | null;
    submittedAt: string | null;
  }[];
}

export interface CampaignFormValues {
  name: string;
  cycle: string;
  startDate: string;
  endDate: string;
  competencies: { competencyId: string; weight: number }[];
  aiGenerated?: boolean;
  aiRationale?: string;
}

export interface SubmitResponseValues {
  scores: { competencyId: string; score: number }[];
  strengths?: string;
  improvements?: string;
  summary?: string;
}

export interface AiDesignerDraft {
  competencies: { name: string; description: string; weight: number }[];
  focus: string;
  rationale: string;
}

export type AiDesignerScope = "employee" | "team" | "department" | "company";

export interface AiDesignerRequest {
  scope: AiDesignerScope;
  targetId?: string;
  instruction?: string;
}

export interface AiDesignerResponse {
  target: { scope: AiDesignerScope; label: string };
  draft: AiDesignerDraft | null;
  configured: boolean;
}

export interface BulkUpsertCompetencyResult {
  competencyId: string;
  name: string;
  weight: number;
}
