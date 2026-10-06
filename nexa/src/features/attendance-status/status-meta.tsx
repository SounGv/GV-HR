import { CalendarDays, CircleCheck, CircleX, Clock, Hourglass } from "lucide-react";
import type { TodayStatus } from "./status-rules";

/**
 * How each status looks and where its list lives. Colours come from the
 * `--status-*` tokens in globals.css (one meaning per colour on every page);
 * every status also has an icon and a word, never colour alone. Class names are
 * written out in full because Tailwind only generates classes it can find.
 */
export interface StatusMeta {
  label: string;
  /** Value of the `status` query parameter on the list page. */
  param: "normal" | "late" | "absent" | "leave" | "notyet";
  icon: typeof Clock;
  /** Tile / badge surface: background, border and text. */
  surface: string;
  /** Filled segment in the proportion bar. */
  segment: string;
  /** Small filled dot. */
  dot: string;
}

export const STATUS_META: Record<TodayStatus, StatusMeta> = {
  NORMAL: {
    label: "ปกติ",
    param: "normal",
    icon: CircleCheck,
    surface: "border-status-normal-border bg-status-normal-bg text-status-normal-fg",
    segment: "bg-status-normal-dot",
    dot: "bg-status-normal-dot",
  },
  LATE: {
    label: "มาสาย",
    param: "late",
    icon: Clock,
    surface: "border-status-late-border bg-status-late-bg text-status-late-fg",
    segment: "bg-status-late-dot",
    dot: "bg-status-late-dot",
  },
  ABSENT: {
    label: "ขาดงาน",
    param: "absent",
    icon: CircleX,
    surface: "border-status-absent-border bg-status-absent-bg text-status-absent-fg",
    segment: "bg-status-absent-dot",
    dot: "bg-status-absent-dot",
  },
  ON_LEAVE: {
    label: "ลางาน",
    param: "leave",
    icon: CalendarDays,
    surface: "border-status-leave-border bg-status-leave-bg text-status-leave-fg",
    segment: "bg-status-leave-dot",
    dot: "bg-status-leave-dot",
  },
  NOT_YET: {
    label: "ยังไม่ถึงเวลา",
    param: "notyet",
    icon: Hourglass,
    surface: "border-status-notyet-border bg-status-notyet-bg text-status-notyet-fg",
    segment: "bg-status-notyet-dot",
    dot: "bg-status-notyet-dot",
  },
};

/** Display order everywhere: the ones that need attention first. */
export const STATUS_ORDER: TodayStatus[] = ["ABSENT", "LATE", "ON_LEAVE", "NOT_YET", "NORMAL"];

/** Address of the list page for one status, keeping the department filter. */
export function attendanceListHref(status: TodayStatus | "all", departmentIds: string[] = []): string {
  const q = new URLSearchParams();
  if (status !== "all") q.set("status", STATUS_META[status].param);
  if (departmentIds.length) q.set("dept", departmentIds.join(","));
  const s = q.toString();
  return `/dashboard/attendance${s ? `?${s}` : ""}`;
}

export function watchListHref(tab: "all" | "late" | "absent" | "leave" = "all", departmentIds: string[] = []): string {
  const q = new URLSearchParams();
  if (tab !== "all") q.set("tab", tab);
  if (departmentIds.length) q.set("dept", departmentIds.join(","));
  const s = q.toString();
  return `/dashboard/attendance/watch${s ? `?${s}` : ""}`;
}
