import type { TodayStatus } from "./status-rules";

export interface TodayPerson {
  employeeId: string;
  code: string;
  name: string;
  department: string;
  departmentId: string | null;
  status: TodayStatus;
  /** HH:mm Bangkok time of today's clock-in, or null. */
  clockIn: string | null;
  /** HH:mm shift start. */
  shiftStart: string;
  /** Minutes after the shift start (only when late). */
  lateMinutes: number | null;
  /** Work mode label (office / WFH / outside) when scanned. */
  workMode: string | null;
}

export interface TodayAttendance {
  /** HH:mm Bangkok time the figures were read. */
  asOf: string;
  /** Today's date, ISO (Bangkok calendar day). */
  dateIso: string;
  isWorkingDay: boolean;
  /** Why today is not a working day (weekend / holiday name). */
  nonWorkingReason: string | null;
  counts: Record<TodayStatus, number>;
  /** People checked (those who use the clock-in app). */
  total: number;
  /** People who have scanned in today. */
  scanned: number;
  /** Active people left out because they have no clock-in history. */
  notChecked: number;
  people: TodayPerson[];
}

export interface WatchPerson {
  code: string;
  name: string;
  department: string;
  late: number;
  absent: number;
  leave: number;
  reasons: ("late" | "absent" | "leave")[];
  score: number;
}

export interface DepartmentWatch {
  department: string;
  people: number;
  late: number;
  absent: number;
  /** (late + absent) per person, used to rank departments. */
  perPerson: number;
}

export interface AttendanceWatch {
  windowDays: number;
  people: WatchPerson[];
  departments: DepartmentWatch[];
  /** Set when the underlying report was cut; the figures cover only from this day (YYYY-MM-DD). */
  truncatedFrom: string | null;
}

export interface DepartmentOption {
  id: string;
  name: string;
}
