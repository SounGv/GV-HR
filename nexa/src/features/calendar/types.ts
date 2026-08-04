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

export interface CalendarMonth {
  month: string; // YYYY-MM
  items: CalendarItem[];
}

export interface EventFormValues {
  title: string;
  description?: string;
  type: EventType;
  startDate: string;
  endDate?: string;
}
