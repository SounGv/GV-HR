export type CalendarSource = "holiday" | "leave" | "training" | "event" | "evaluation" | "meeting";
export type EventType = "event" | "meeting" | "deadline";

export interface CalendarItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  source: CalendarSource;
  type: string;
  eventId?: string; // present for editable company events
  href?: string; // present for view-only linked items (e.g. evaluation campaigns)
}

/** The viewer's own day status — only computed up to today (past days are known, future days are omitted). */
export type MyDayStatus = "PRESENT" | "LATE" | "HOLIDAY" | "LEAVE" | "WEEKEND" | "ABSENT";

export interface CalendarMonth {
  month: string; // YYYY-MM
  items: CalendarItem[];
  myStatus?: Record<string, MyDayStatus>; // date (YYYY-MM-DD) -> status, viewer's own attendance
}

/** One person who needs a line on the day panel (absent, late, or on leave; people on time are only counted). */
export interface CalendarDayPerson {
  employeeId: string;
  name: string;
  department: string;
  status: "NORMAL" | "LATE" | "ABSENT" | "ON_LEAVE" | "NOT_YET";
  clockIn: string | null;
  lateMinutes: number | null;
  /** Came in but also took an hour or half a day as leave. */
  partialLeave: boolean;
}

/** Head-counts drawn inside one calendar cell. */
export interface CalendarDayCounts {
  absent: number;
  leave: number;
  late: number;
}

/** Attendance of the whole company on one day, for people who may see attendance. */
export interface CalendarDayAttendance {
  dateIso: string;
  isFuture: boolean;
  isWorkingDay: boolean;
  nonWorkingReason: string | null;
  /** People checked: those who use the clock-in app. */
  total: number;
  notChecked: number;
  counts: Record<"NORMAL" | "LATE" | "ABSENT" | "ON_LEAVE" | "NOT_YET", number>;
  people: CalendarDayPerson[];
}

export interface EventFormValues {
  title: string;
  description?: string;
  type: EventType;
  startDate: string;
  endDate?: string;
}
