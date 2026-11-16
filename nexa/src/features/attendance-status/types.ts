import type { TodayStatus } from "./status-rules";

export interface TodayPerson {
  employeeId: string;
  /** MALE / FEMALE / OTHER / null — picks the character avatar when there is no photo. */
  gender: string | null;
  /** Short address of the person's photo (see lib/avatar-server.ts); null or missing = no photo. */
  avatarUrl?: string | null;
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
  /** Leave type(s) such as "ลาป่วย" when the person is on leave today, else null. */
  leaveType: string | null;
  /** Leave taken today by the hour or by half a day while the person also came in, e.g. "ลากิจ 09:00-10:00"; else null. */
  leaveNote: string | null;
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
  /**
   * Saturday only: people scanned, late and on leave when the day is not a normal working day. Many people do work Saturdays but
   * the system has no schedule saying who must, so nobody is counted absent; this only shows what did happen.
   */
  weekendActivity?: { scanned: number; late: number; onLeave: number } | null;
}

export interface WatchPerson {
  code: string;
  /** Seeds the character avatar so a person looks the same on every screen. */
  employeeId?: string;
  /** MALE / FEMALE / OTHER / null — picks the character avatar (looked up after the report). */
  gender?: string | null;
  /** Short address of the person's photo; null or missing = no photo. */
  avatarUrl?: string | null;
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
