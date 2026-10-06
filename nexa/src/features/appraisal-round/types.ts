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
}

export interface DepartmentProgress {
  department: string;
  submitted: number;
  total: number;
  percent: number;
}
