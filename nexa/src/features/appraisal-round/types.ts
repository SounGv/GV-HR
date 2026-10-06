import type { SnapQuestion } from "./answers";
import type { RaterType } from "./rules";

export type { RaterType, SnapQuestion };
export type RoundStatus = "DRAFT" | "SCHEDULED" | "OPEN" | "CLOSED";
export type AssignmentStatus = "PENDING" | "IN_PROGRESS" | "SUBMITTED";

export const RATER_LABEL: Record<RaterType, string> = {
  SELF: "ตนเอง",
  MANAGER: "หัวหน้า",
  PEER: "เพื่อนร่วมงาน",
  SUBORDINATE: "ลูกน้อง",
};

export const ROUND_STATUS_LABEL: Record<RoundStatus, string> = {
  DRAFT: "ฉบับร่าง",
  SCHEDULED: "ตั้งเวลาไว้",
  OPEN: "เปิดอยู่",
  CLOSED: "ปิดแล้ว",
};

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  PENDING: "ยังไม่เริ่ม",
  IN_PROGRESS: "กำลังทำ",
  SUBMITTED: "ส่งแล้ว",
};

export interface RoundListItem {
  id: string;
  name: string;
  status: RoundStatus;
  formName: string;
  startIso: string | null;
  endIso: string | null;
  participantCount: number;
  submitted: number;
  total: number;
}

export interface Candidate {
  id: string;
  code: string;
  name: string;
  departmentId: string | null;
  department: string;
  hasManager: boolean;
}

export interface PublishedForm {
  id: string;
  name: string;
  questionCount: number;
}

export interface RoundCheck {
  key: "form" | "people" | "raters" | "schedule";
  ok: boolean;
  why: string;
}

export interface RoundDetail {
  id: string;
  name: string;
  status: RoundStatus;
  formId: string;
  formName: string;
  /** People rated with a form other than the round's own: employeeId -> form id. */
  participantForms: Record<string, string>;
  formsUsed: { id: string; name: string }[];
  raterTypes: RaterType[];
  perspectiveWeights: Partial<Record<RaterType, number>>;
  startIso: string | null;
  endIso: string | null;
  remind: boolean;
  notifyLine: boolean;
  openedAt: string | null;
  notifiedAt: string | null;
  participantIds: string[];
  matching: {
    assignmentCount: number;
    byType: Record<string, number>;
    exceptions: { kind: "NO_MANAGER" | "NO_PEERS" | "NO_RATER" | "OVERLOADED"; employeeId: string; name: string; detail: number | null }[];
  };
  invitations: {
    total: number;
    withLine: number;
    appOnly: number;
    unreachable: number;
    unreachableNames: string[];
    lineConfigured: boolean;
  };
  checks: RoundCheck[];
  ready: boolean;
}

export interface RoundProgress {
  total: number;
  submitted: number;
  inProgress: number;
  pending: number;
}

export interface TaskItem {
  id: string;
  raterType: RaterType;
  status: AssignmentStatus;
  personName: string;
  personCode: string;
  roundId: string;
  roundName: string;
  roundStatus: RoundStatus;
  endIso: string | null;
}

export interface TaskDetail {
  id: string;
  raterType: RaterType;
  status: AssignmentStatus;
  personName: string;
  personCode: string;
  roundName: string;
  roundStatus: RoundStatus;
  endIso: string | null;
  ratingMax: number;
  questions: SnapQuestion[];
  answers: { questionId: string; value: number | string | string[] }[];
}

/** What the wizard sends when saving a step. */
export interface RoundSavePayload {
  name?: string;
  formId?: string;
  raterTypes?: RaterType[];
  perspectiveWeights?: Partial<Record<RaterType, number>>;
  /** employeeId -> form id (null = the round's own form). */
  participantForms?: Record<string, string | null>;
  startDate?: string | null;
  endDate?: string | null;
  remind?: boolean;
  notifyLine?: boolean;
  participantIds?: string[];
}

export interface MatrixRow {
  participantId: string;
  name: string;
  code: string;
  department: string;
  assignments: { id: string; raterType: RaterType; status: AssignmentStatus; raterName: string }[];
}

export interface QuestionSummary {
  questionId: string;
  text: string;
  answerType: "RATING" | "CHOICE" | "MULTI_CHOICE" | "SHORT_TEXT" | "PARAGRAPH";
  count: number;
  average: number | null;
  options: { label: string; count: number }[];
  texts: string[];
}

export interface ParticipantResult {
  participantId: string;
  name: string;
  code: string;
  department: string;
  roundName: string;
  roundStatus: string;
  groups: { raterType: RaterType; total: number; submitted: number; summary: QuestionSummary[] }[];
  result: {
    status: ResultStatus;
    scorePercent: number | null;
    overallScore: number | null;
    grade: string | null;
    types: { raterType: RaterType; raters: number; percent: number; weightUsed: number }[];
  };
}

export interface DepartmentProgress {
  department: string;
  submitted: number;
  total: number;
  percent: number;
}

export type ResultStatus = "NOT_CALCULATED" | "CALCULATED" | "APPROVED" | "PUBLISHED" | "ACKNOWLEDGED";

export const RESULT_STATUS_LABEL: Record<ResultStatus, string> = {
  NOT_CALCULATED: "ยังไม่คำนวณ",
  CALCULATED: "คำนวณแล้ว",
  APPROVED: "อนุมัติแล้ว",
  PUBLISHED: "ประกาศแล้ว",
  ACKNOWLEDGED: "รับทราบแล้ว",
};

export interface SettingsView {
  configured: boolean;
  calcMode: "WEIGHTED" | "SIMPLE";
  bands: { label: string; minPercent: number }[];
  approvalLevels: number;
  employeeSees: "NEVER" | "AFTER_PUBLISH";
  ackRequired: boolean;
  ackDays: number | null;
}

export interface ResultRow {
  participantId: string;
  name: string;
  code: string;
  department: string;
  status: ResultStatus;
  scorePercent: number | null;
  overallScore: number | null;
  grade: string | null;
}

export interface MyResult {
  participantId: string;
  roundName: string;
  publishedAt: string | null;
  status: "PUBLISHED" | "ACKNOWLEDGED";
  scorePercent: number | null;
  overallScore: number | null;
  ratingMax: number;
  grade: string | null;
  needsAck: boolean;
  ackDays: number | null;
  types: { raterType: RaterType; raters: number; percent: number }[];
  comments: { raterType: RaterType; texts: string[] }[];
  hiddenGroups: RaterType[];
}

export interface HrAssignmentDetail extends TaskDetail {
  raterName: string;
}
