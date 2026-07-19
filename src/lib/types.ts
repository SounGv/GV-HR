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

export type Role = "employee" | "manager" | "hr";

export interface Me {
  id: number;
  employeeCode: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  position: string;
  managerId: number | null;
  phone: string | null;
  startDate: string | null;
}

export interface AttendanceRecordRow {
  id: number;
  employeeId: number;
  workDate: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockInLat: number | null;
  clockInLng: number | null;
  clockOutLat: number | null;
  clockOutLng: number | null;
}

export interface LeaveRequestRow {
  id: number;
  requestCode: string;
  type: LeaveTypeKey;
  key: LeaveTypeKey;
  dateLabel: string;
  sub: string;
  status: RequestStatus;
  submitted: string;
  employeeId: number;
  employeeName: string;
  reason: string | null;
  attachmentUrl: string | null;
  otStartTime?: string | null;
  otEndTime?: string | null;
  otHours?: number | null;
}

export interface LeaveBalanceRow {
  key: string;
  label: string;
  total: number;
  used: number;
  remain: number;
}

export interface LeaveDraft {
  step: 1 | 2 | 3 | 4;
  type: LeaveTypeKey | null;
  from: string;
  to: string;
  half: "full" | "half";
  otStart: string;
  otEnd: string;
  reason: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  uploading: boolean;
}

export interface HolidayItem {
  id: number;
  dateISO: string;
  name: string;
  type: "company" | "national";
  notifyEnabled: boolean;
}

export interface HolidayForm {
  name: string;
  date: string;
  type: "company" | "national";
  notify: boolean;
}

export interface Workplace {
  id: number;
  name: string;
  radiusMeters: number;
  qrToken?: string;
}

export type GpsPhase = "qr" | "progress" | "result" | "error";

export interface GpsState {
  mode: "in" | "out";
  phase: GpsPhase;
  workplaceId: number;
  qrToken?: string;
  step: number;
  lat?: number;
  lng?: number;
  verified?: boolean;
  distance?: number;
  workplaceName?: string;
  radiusMeters?: number;
  error?: string;
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
  id: number;
  employeeCode: string;
  name: string;
  department: string;
  scores: string;
}

export type ReportTab = "attendance" | "leave" | "finance";

export interface ReportData {
  title: string;
  updated: string;
  cards: { label: string; value: string; color: string }[];
  rows: { name: string; val: string; p: number }[];
}

export interface NotificationRow {
  id: number;
  icon: string;
  color: string;
  bg: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface PayrollRow {
  id: number;
  period: string;
  periodLabel: string;
  earnings: { label: string; amt: number }[];
  deductions: { label: string; amt: number }[];
  gross: number;
  totalDeductions: number;
  net: number;
}

export interface PerformanceRow {
  id: number;
  cycle: string;
  overallScore: number;
  band: string;
  kpis: { label: string; score: number }[];
  competencies: { label: string; cur: number; tgt: number }[];
  idpTitle: string | null;
  idpDescription: string | null;
  idpTargetDate: string | null;
  idpProgressPercent: number | null;
}
