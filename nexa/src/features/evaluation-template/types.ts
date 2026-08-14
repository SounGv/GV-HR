export type TemplateStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type AnswerType = "NUMERIC" | "LETTER" | "CHOICE" | "YES_NO" | "LONG_TEXT";

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
  updatedAt: string;
}

export interface TemplateDetail extends TemplateListItem {
  aiRationale: string | null;
  sections: TemplateSection[];
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
  scope: AiTemplateScope;
  targetId?: string;
  instruction?: string;
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
  configured: boolean;
}
