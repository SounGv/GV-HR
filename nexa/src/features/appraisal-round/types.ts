import type { SnapQuestion } from "./answers";
import type { CommentsView } from "./imported-comments";
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
  /** A draft kept only to be copied each month; it is never opened itself. */
  isTemplate: boolean;
  /** "90°" … "360°" or "กำหนดเอง". */
  ratingType: string;
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
  gender: string | null;
  /** Short address of the photo; null = none. */
  avatarUrl?: string | null;
}

export interface PublishedForm {
  id: string;
  name: string;
  questionCount: number;
}

/** One person in the round and who will rate them, as matched from the org chart. */
export interface MatchRow {
  employeeId: string;
  name: string;
  gender: string | null;
  avatarUrl?: string | null;
  department: string;
  managerId: string | null;
  managerName: string | null;
  managerGender: string | null;
  managerAvatarUrl?: string | null;
  /** How many MANAGER-type raters (more than one when HR added raters by hand). */
  managers: number;
  /** Every rater of this person after the org chart and the hand-set pairs are put together. */
  raters: { id: string; name: string; type: RaterType; manual: boolean }[];
  self: boolean;
  peers: number;
  subs: number;
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
  /** Pairs HR set by hand on top of the org-chart matching (employee ids). */
  overrides: {
    add: { participantId: string; raterId: string; raterType: RaterType }[];
    remove: { participantId: string; raterId: string; raterType: RaterType }[];
    /** Peers are only the pairs HR picks (no automatic same-manager peers). */
    manualPeers?: boolean;
  };
  startIso: string | null;
  endIso: string | null;
  remind: boolean;
  notifyLine: boolean;
  openedAt: string | null;
  notifiedAt: string | null;
  participantIds: string[];
  /** Set only when the viewer may not see who is in the round (a manager): the head count, with the ids left out. */
  participantCount?: number;
  matching: {
    assignmentCount: number;
    byType: Record<string, number>;
    exceptions: { kind: "NO_MANAGER" | "NO_PEERS" | "NO_RATER" | "OVERLOADED"; employeeId: string; name: string; detail: number | null }[];
    /** Different people who will get an invitation. */
    raterCount: number;
    manual: { added: number; removed: number; ignored: number };
    rows: MatchRow[];
  };
  invitations: {
    total: number;
    withLine: number;
    appOnly: number;
    unreachable: number;
    unreachableNames: string[];
    lineConfigured: boolean;
    /** The rater with the most people to rate, for the message preview. */
    example: { name: string; count: number } | null;
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
  /** For the character avatar; null = not recorded. */
  personGender: string | null;
  /** Short address of the person's photo; null = none. */
  personAvatarUrl?: string | null;
  /** "position · department" at the time the round opened. */
  personRole: string | null;
  roundName: string;
  roundStatus: RoundStatus;
  endIso: string | null;
  ratingMax: number;
  /** Score names frozen with the round; null = the system's original names. */
  ratingLabels: unknown;
  /** The lowest score needs a written example. */
  noteAtLowest: boolean;
  questions: SnapQuestion[];
  answers: { questionId: string; value: number | string | string[]; note?: string }[];
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
  /** Rater pairs set by hand on top of the org-chart matching; null clears them. */
  raterPairs?: { add: { participantId: string; raterId: string; raterType: RaterType }[]; remove: { participantId: string; raterId: string; raterType: RaterType }[]; manualPeers?: boolean } | null;
}

export interface MatrixRow {
  participantId: string;
  name: string;
  code: string;
  department: string;
  /** `submittedAt` (ISO date) and `percent` are filled for HR only, and only once the sheet is submitted. */
  assignments: { id: string; raterType: RaterType; status: AssignmentStatus; raterName: string; submittedAt: string | null; percent: number | null }[];
}

export interface QuestionSummary {
  questionId: string;
  text: string;
  section: string | null;
  answerType: "RATING" | "CHOICE" | "MULTI_CHOICE" | "SHORT_TEXT" | "PARAGRAPH";
  count: number;
  average: number | null;
  options: { label: string; count: number }[];
  texts: string[];
  /** RATING only: raters per score, highest first. */
  scores: { score: number; count: number }[];
  /** RATING only: written examples with the score given. */
  notes: { score: number; text: string }[];
  levelDescriptions: { score: number; text: string }[] | null;
}

export interface ParticipantResult {
  participantId: string;
  name: string;
  code: string;
  department: string;
  roundName: string;
  roundStatus: string;
  ratingMax: number;
  /** Score names frozen with the round; null = system names. */
  ratingLabels: unknown;
  groups: { raterType: RaterType; total: number; submitted: number; /** True when written answers are held back because too few people answered. */ textsHeld: boolean; summary: QuestionSummary[] }[];
  result: {
    status: ResultStatus;
    scorePercent: number | null;
    overallScore: number | null;
    grade: string | null;
    /** Set only for HR when the score was changed by hand: what the calculation gave. */
    adjustedFrom: number | null;
    types: { raterType: RaterType; raters: number; percent: number; weightUsed: number }[];
  };
  /** Comments copied from another system for a round with no answer sheets; null when there are none. Already filtered for this viewer. */
  importedComments: CommentsView | null;
  /** HR only (null for everyone else): each submitted sheet that has written text, with the rater's name. */
  namedComments: { assignmentId: string; raterType: RaterType; raterName: string; score: number | null; submittedAt: Date | string | null; texts: string[] }[] | null;
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
  /** Brought in from Favpo: only the person's total exists, there are no answers behind it. */
  imported: boolean;
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

/* ───────────────────────── recurring rounds ───────────────────────── */

export interface RecurrenceItem {
  id: string;
  name: string;
  frequency: "MONTHLY" | "QUARTERLY" | "YEARLY";
  openDay: number;
  closeDay: number;
  formId: string;
  formName: string;
  preset: string;
  /** Empty means every active employee. */
  departmentNames: string[];
  enabled: boolean;
  /** The next rounds the job will make, with the name each will get. */
  upcoming: { periodKey: string; name: string; startIso: string; endIso: string }[];
  roundsMade: number;
  lastRound: { id: string; name: string; status: RoundStatus } | null;
}

export type RecurrenceBody = {
  name: string;
  frequency: RecurrenceItem["frequency"];
  openDay: number;
  closeDay: number;
  formId: string;
  preset: string;
  departmentNames: string[];
  enabled?: boolean;
};

/* ───────────────────────── review page (ทบทวนผล) ───────────────────────── */

export interface ReviewPerson {
  participantId: string;
  name: string;
  code: string;
  department: string;
  status: ResultStatus;
  /** Percent given by the person themself and by their manager; null when that side has not answered. */
  self: number | null;
  manager: number | null;
  total: number;
  grade: string | null;
  /** Self minus manager. */
  gap: number | null;
  /** Self is far above the manager's score. */
  talk: boolean;
  /** Total is within a point of a grade boundary. */
  nearEdge: boolean;
  /** HR changed this score by hand; `original` is what the calculation gave. */
  adjusted: boolean;
  original: number | null;
}

export interface ReviewAdjustment {
  id: string;
  participantId: string;
  name: string;
  kind: "ADJUST" | "REVERT";
  fromPercent: number;
  toPercent: number;
  fromGrade: string | null;
  toGrade: string | null;
  reason: string;
  byName: string;
  createdAt: string;
}

export interface ReviewSpread {
  counts: number[];
  below: number;
}

export interface RoundReview {
  roundName: string;
  status: RoundStatus;
  /** People in the round the viewer may see. */
  total: number;
  /** Of those, how many have a calculated result. */
  calculated: number;
  /** Every calculated result was brought in from Favpo, so there is no self/manager split to show. */
  imported: boolean;
  /** How many sit at the top score; `flag` when most do. */
  ceiling: { count: number; total: number; flag: boolean };
  /** Grade labels from the highest threshold down; empty when HR has not set grade bands. */
  bands: string[];
  spread: ReviewSpread & { byDepartment: (ReviewSpread & { department: string; total: number })[] };
  /** False when the viewer sees only the people under them, so "company" means "the people you can see". */
  companyWide: boolean;
  managers: {
    rows: import("./review-rules").ManagerRow[];
    companyAverage: number | null;
  };
  people: ReviewPerson[];
  /** Latest changes first. Shown to HR and approvers, never to the employee. */
  adjustments: ReviewAdjustment[];
  /** HR only: may change a calculated score. */
  canAdjust: boolean;
  thresholds: { managerGap: number; selfGap: number; minPeople: number; maxAdjust: number };
}
