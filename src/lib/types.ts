export type ViewKey =
  | "home"
  | "attendance"
  | "requests"
  | "payroll"
  | "more"
  | "perf"
  | "notifs"
  | "payslip"
  | "profile"
  | "leave"
  | "reports"
  | "holidays"
  | "aieval";

export type TabKey = "home" | "attendance" | "requests" | "payroll" | "more";

export type RequestStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";

export type LeaveTypeKey = "annual" | "sick" | "personal" | "unpaid" | "ot" | "correction";

export interface LeaveRequest {
  id: string;
  type: string;
  key: LeaveTypeKey;
  dateLabel: string;
  sub: string;
  status: RequestStatus;
  submitted: string;
}

export interface HolidayItem {
  id: number;
  dateISO: string;
  name: string;
  type: "วันหยุดบริษัท" | "นักขัตฤกษ์";
  notify: boolean;
}

export interface LeaveDraft {
  step: 1 | 2 | 3 | 4;
  type: LeaveTypeKey | null;
  from: string;
  to: string;
  half: "full" | "half";
  reason: string;
  attach: boolean;
}

export interface HolidayForm {
  name: string;
  date: string;
  type: "วันหยุดบริษัท" | "นักขัตฤกษ์";
  notify: boolean;
}

export interface GpsState {
  mode: "in" | "out";
  phase: "locating" | "ready";
}

export type AiMode = "criteria" | "draft";

export interface AiCompetency {
  name: string;
  weight: number;
  indicators: string[];
}

export interface AiKpi {
  name: string;
  weight: number;
  target: string;
}

export interface AiCriteriaResult {
  type: "criteria";
  summary: string;
  competencies: AiCompetency[];
  kpis: AiKpi[];
}

export interface AiDraftResult {
  type: "draft";
  overall: string;
  strengths: string[];
  improvements: string[];
  development: string[];
  summary: string;
}

export type AiResult = AiCriteriaResult | AiDraftResult;

export interface AiEmployee {
  name: string;
  dept: string;
  scores: string;
}

export type ReportTab = "attendance" | "leave" | "finance";
