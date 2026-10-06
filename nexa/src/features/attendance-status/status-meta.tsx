import { CalendarDays, CircleCheck, CircleX, Clock, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
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
  /** Full-row tint in a table (empty for statuses that stay plain). */
  row: string;
  /** Thick left edge on the first cell of a tinted row. */
  bar: string;
  /** Tint for a phone card. */
  card: string;
}

export const STATUS_META: Record<TodayStatus, StatusMeta> = {
  NORMAL: {
    label: "ปกติ",
    param: "normal",
    icon: CircleCheck,
    surface: "border-status-normal-border bg-status-normal-bg text-status-normal-fg",
    segment: "bg-status-normal-dot",
    dot: "bg-status-normal-dot",
    row: "",
    bar: "",
    card: "",
  },
  LATE: {
    label: "มาสาย",
    param: "late",
    icon: Clock,
    surface: "border-status-late-border bg-status-late-bg text-status-late-fg",
    segment: "bg-status-late-dot",
    dot: "bg-status-late-dot",
    row: "bg-status-late-bg hover:bg-[color-mix(in_oklab,var(--status-late-bg)_92%,var(--foreground))]",
    bar: "shadow-[inset_5px_0_0_var(--status-late-dot)]",
    card: "border-status-late-border bg-status-late-bg",
  },
  ABSENT: {
    label: "ขาดงาน",
    param: "absent",
    icon: CircleX,
    surface: "border-status-absent-border bg-status-absent-bg text-status-absent-fg",
    segment: "bg-status-absent-dot",
    dot: "bg-status-absent-dot",
    row: "bg-status-absent-bg hover:bg-[color-mix(in_oklab,var(--status-absent-bg)_92%,var(--foreground))]",
    bar: "shadow-[inset_5px_0_0_var(--status-absent-dot)]",
    card: "border-status-absent-border bg-status-absent-bg",
  },
  ON_LEAVE: {
    label: "ลางาน",
    param: "leave",
    icon: CalendarDays,
    surface: "border-status-leave-border bg-status-leave-bg text-status-leave-fg",
    segment: "bg-status-leave-dot",
    dot: "bg-status-leave-dot",
    row: "bg-status-leave-bg hover:bg-[color-mix(in_oklab,var(--status-leave-bg)_92%,var(--foreground))]",
    bar: "shadow-[inset_5px_0_0_var(--status-leave-dot)]",
    card: "border-status-leave-border bg-status-leave-bg",
  },
  NOT_YET: {
    label: "ยังไม่ถึงเวลา",
    param: "notyet",
    icon: Hourglass,
    surface: "border-status-notyet-border bg-status-notyet-bg text-status-notyet-fg",
    segment: "bg-status-notyet-dot",
    dot: "bg-status-notyet-dot",
    row: "",
    bar: "",
    card: "",
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

/** Status as icon + word (never colour alone), used on every list and in the side panel. */
export function AttendanceStatusBadge({ status, className }: { status: TodayStatus; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        meta.surface,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
