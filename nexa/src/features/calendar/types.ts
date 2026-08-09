export type CalendarSource = "holiday" | "leave" | "training" | "event" | "evaluation";
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

export interface EventFormValues {
  title: string;
  description?: string;
  type: EventType;
  startDate: string;
  endDate?: string;
}
