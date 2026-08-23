import type { CampaignTemplateSnapshot } from "@/features/evaluation-template/types";

export type CampaignStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export type RaterType = "SELF" | "MANAGER" | "PEER" | "UPWARD" | "HR_EXEC";
export type ResponseStatus = "PENDING" | "SUBMITTED";

export interface CampaignCompetency {
  competencyId: string;
  name: string;
  description: string | null;
  exampleBehavior: string | null;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  weight: number;
}

export interface CampaignListItem {
  id: string;
  name: string;
  cycle: string;
  startDate: string;
  endDate: string;
  status: CampaignStatus;
  raterTypes: RaterType[];
  aiGenerated: boolean;
  participantCount: number;
  templateId: string | null;
}

export interface CampaignDetail extends CampaignListItem {
  aiRationale: string | null;
  competencies: CampaignCompetency[];
  templateSnapshot: CampaignTemplateSnapshot | null;
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
  campaign: {
    id: string;
    name: string;
    cycle: string;
    raterTypes: RaterType[];
    competencies: CampaignCompetency[];
    templateSnapshot: CampaignTemplateSnapshot | null;
  };
  fullResponses: {
    id: string;
    raterType: RaterType;
    raterEmployeeId: string;
    status: ResponseStatus;
    scores: { competencyId: string; score: number }[];
    answers: { questionId: string; value: string }[] | null;
    strengths: string | null;
    improvements: string | null;
    summary: string | null;
    evidenceUrls: string[] | null;
    submittedAt: string | null;
    raterEmployee: { firstName: string; lastName: string; avatarUrl: string | null } | null;
  }[];
}

export interface CampaignFormValues {
  name: string;
  cycle: string;
  startDate: string;
  endDate: string;
  status?: CampaignStatus;
  raterTypes: RaterType[];
  templateId?: string;
  competencies?: { competencyId: string; weight: number }[];
  aiGenerated?: boolean;
  aiRationale?: string;
}

export interface SubmitResponseValues {
  scores?: { competencyId: string; score: number }[];
  answers?: { questionId: string; value: string }[];
  strengths?: string;
  improvements?: string;
  summary?: string;
  evidenceUrls?: string[];
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

export interface EmployeeEvaluationHistoryItem {
  participantId: string;
  overallScore: number | null;
  band: string | null;
  calibratedScore: number | null;
  calibratedBand: string | null;
  finalizedAt: string | null;
  campaign: {
    id: string;
    name: string;
    cycle: string;
    status: CampaignStatus;
    startDate: string;
    endDate: string;
  };
}

export interface MyPendingResponse {
  responseId: string;
  raterType: RaterType;
  participantId: string;
  campaignId: string;
  campaignName: string;
  cycle: string;
  startDate: string;
  endDate: string;
  employee: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
  /** Total scoreable questions/competencies for this campaign's form. */
  totalQuestions: number;
}

/** Same shape as `MyPendingResponse`, plus status — pending AND submitted, with history. */
export interface MyEvaluationAssignment extends MyPendingResponse {
  status: "PENDING" | "SUBMITTED";
  submittedAt: string | null;
}

export interface BulkUpsertCompetencyResult {
  competencyId: string;
  name: string;
  weight: number;
}
