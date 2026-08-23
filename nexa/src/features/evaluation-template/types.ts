export type TemplateStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type AnswerType = "NUMERIC" | "LETTER" | "CHOICE" | "YES_NO" | "LONG_TEXT" | "SHORT_TEXT" | "FILE_EVIDENCE";

// Duplicated from campaign/types.ts's RaterType rather than imported — that
// module imports CampaignTemplateSnapshot from here, so importing back would
// be circular. It's a 5-value string union, not worth a shared module for.
export type TemplateVisibleToType = "SELF" | "MANAGER" | "PEER" | "UPWARD" | "HR_EXEC";

export interface TemplateOption {
  value: string;
  label: string;
  score: number;
}

export interface TemplateQuestion {
  id: string;
  text: string;
  helpText: string | null;
  answerType: AnswerType;
  options: TemplateOption[] | null;
  weight: number;
  required: boolean;
  order: number;
  /** Which rater types see/answer this question — empty means everyone. */
  visibleTo: TemplateVisibleToType[];
  /** Set when this question was pulled from the reusable Question Bank
   * (Competency) rather than authored ad-hoc. */
  competencyId: string | null;
}

export interface TemplateSection {
  id: string;
  name: string;
  order: number;
  questions: TemplateQuestion[];
}

export interface TemplateListItem {
  id: string;
  name: string;
  description: string | null;
  status: TemplateStatus;
  aiGenerated: boolean;
  sectionCount: number;
  questionCount: number;
  totalWeight: number;
  version: number;
  evaluationType: string | null;
  departmentId: string | null;
  positionId: string | null;
  clonedFromId: string | null;
  updatedAt: string;
}

export interface TemplateDetail extends TemplateListItem {
  aiRationale: string | null;
  sections: TemplateSection[];
  /** How many campaigns (any status) currently reference this template —
   * "used in N cycles" hint in the list/detail view. */
  campaignCount: number;
}

export interface QuestionFormValues {
  text: string;
  helpText?: string;
  answerType: AnswerType;
  options?: TemplateOption[];
  weight: number;
  required: boolean;
  order: number;
  visibleTo: TemplateVisibleToType[];
  competencyId?: string | null;
}

export interface SectionFormValues {
  name: string;
  order: number;
  questions: QuestionFormValues[];
}

export interface TemplateFormValues {
  name: string;
  description?: string;
  status?: TemplateStatus;
  evaluationType?: string;
  departmentId?: string;
  positionId?: string;
  sections: SectionFormValues[];
  aiGenerated?: boolean;
  aiRationale?: string;
}

// Frozen copy stored on EvaluationCampaign.templateSnapshot / read back as-is —
// editing the source EvaluationTemplate later never changes this.
export interface CampaignTemplateSnapshot {
  templateId: string;
  name: string;
  description: string | null;
  sections: TemplateSection[];
}

export type AiTemplateScope = "department" | "company";

export interface AiTemplateDesignerRequest {
  mode?: "generate" | "critique";
  scope: AiTemplateScope;
  targetId?: string;
  instruction?: string;
  /** Only used when mode === "critique" — the HR-edited draft to review. */
  draft?: { name: string; description?: string; sections: SectionFormValues[] };
}

export interface AiTemplateDraft {
  name: string;
  description: string;
  rationale: string;
  sections: {
    name: string;
    questions: {
      text: string;
      helpText?: string;
      answerType: AnswerType;
      options?: TemplateOption[];
      weight: number;
      required: boolean;
    }[];
  }[];
}

export interface AiTemplateDesignerResponse {
  target: { scope: AiTemplateScope; label: string };
  draft: AiTemplateDraft | null;
  /** Only present for mode === "critique" — short bullet feedback on the
   * HR-edited draft, alongside the (optional) improved `draft` above. */
  findings: string[] | null;
  configured: boolean;
}
