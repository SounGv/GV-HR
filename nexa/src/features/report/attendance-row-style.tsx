import type { ReactNode } from "react";
import { CalendarDays, CircleCheck, CircleX, Clock } from "lucide-react";

import { ATTENDANCE_STATUS_LABEL } from "@/features/attendance/status-badge";
import type { AttendanceStatus } from "@/features/attendance/types";
import { LEAVE_TYPE_LABEL } from "@/features/leave/labels";
import { cn } from "@/lib/utils";
import type { ReportColumn } from "./types";
import type { PhotoPreview } from "./report-photo-cell";

type Row = Record<string, string | number>;

/**
 * Colour language for the daily attendance report: yellow = late, red =
 * absent, blue = leave; a normal day stays plain. Colours come from the
 * `--status-*` tokens in globals.css and are always paired with an icon and a
 * word (see ReportStatusBadge), never colour alone.
 *
 * Class names are written out in full on purpose — Tailwind only generates
 * classes it can find as whole strings.
 */
const TONE: Partial<
  Record<AttendanceStatus, { row: string; bar: string; card: string; header: string }>
> = {
  LATE: {
    row: "bg-status-late-bg hover:bg-[color-mix(in_oklab,var(--status-late-bg)_92%,var(--foreground))]",
    bar: "shadow-[inset_5px_0_0_var(--status-late-dot)]",
    card: "border-status-late-border bg-status-late-bg",
    header: "border-status-late-border bg-foreground/5",
  },
  ABSENT: {
    row: "bg-status-absent-bg hover:bg-[color-mix(in_oklab,var(--status-absent-bg)_92%,var(--foreground))]",
    bar: "shadow-[inset_5px_0_0_var(--status-absent-dot)]",
    card: "border-status-absent-border bg-status-absent-bg",
    header: "border-status-absent-border bg-foreground/5",
  },
  ON_LEAVE: {
    row: "bg-status-leave-bg hover:bg-[color-mix(in_oklab,var(--status-leave-bg)_92%,var(--foreground))]",
    bar: "shadow-[inset_5px_0_0_var(--status-leave-dot)]",
    card: "border-status-leave-border bg-status-leave-bg",
    header: "border-status-leave-border bg-foreground/5",
  },
};

function toneOf(row: Row) {
  const key = row.statusKey as AttendanceStatus | undefined;
  return key ? TONE[key] : undefined;
}

/** Full-row tint for a daily-report table row (undefined for a normal day). */
export function dailyRowClass(row: Row): string | undefined {
  return toneOf(row)?.row;
}

/** Thick left edge, applied to the first cell of a tinted row. */
export function dailyRowBarClass(row: Row): string | undefined {
  return toneOf(row)?.bar;
}

export function dailyCardClass(row: Row): { card?: string; header?: string } {
  const t = toneOf(row);
  return { card: t?.card, header: t?.header };
}

const BADGE: Record<AttendanceStatus, { icon: typeof Clock; className: string }> = {
  PRESENT: {
    icon: CircleCheck,
    className: "border-status-normal-border bg-status-normal-bg text-status-normal-fg",
  },
  LATE: { icon: Clock, className: "border-status-late-border bg-status-late-bg text-status-late-fg" },
  ABSENT: { icon: CircleX, className: "border-status-absent-border bg-status-absent-bg text-status-absent-fg" },
  ON_LEAVE: {
    icon: CalendarDays,
    className: "border-status-leave-border bg-status-leave-bg text-status-leave-fg",
  },
};

/** Status as icon + word, from the `statusKey` the service already sends. */
export function ReportStatusBadge({ statusKey, fallback }: { statusKey?: string; fallback?: ReactNode }) {
  const style = statusKey ? BADGE[statusKey as AttendanceStatus] : undefined;
  if (!style) return <>{fallback ?? statusKey}</>;
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        style.className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {ATTENDANCE_STATUS_LABEL[statusKey as AttendanceStatus]}
    </span>
  );
}

/** Note cell: a sick-leave note gets the orange tag inside the blue leave row. */
export function ReportNoteCell({ row, value }: { row: Row; value: string | number | undefined }) {
  const text = value == null ? "-" : String(value);
  if (row.statusKey === "ON_LEAVE" && text.startsWith(LEAVE_TYPE_LABEL.SICK)) {
    return (
      <span className="inline-flex rounded-md bg-leave-sick-bg px-2 py-0.5 text-xs font-semibold text-leave-sick-fg">
        {text}
      </span>
    );
  }
  return <>{text}</>;
}

// ---------------------------------------------------------------------------
// Which columns show by default. Every column the service returns stays
// reachable: the "extra" ones sit behind the toggle, and any column this file
// does not know about is treated as extra rather than dropped. Exports never
// use this list — they read `result.columns` directly.
// ---------------------------------------------------------------------------

export interface DisplayColumn extends ReportColumn {
  /** Derived column (e.g. shift start + end): how to read its text from a row. */
  value?: (row: Row) => string | number;
}

const MAIN_KEYS = [
  "date",
  "code",
  "name",
  "department",
  "shift",
  "clockIn",
  "clockInPhoto",
  "clockOut",
  "clockOutPhoto",
  "lateMinutes",
  "earlyMinutes",
  "hours",
  "otHours",
  "otStatus",
  "status",
  "place",
  "note",
] as const;

const EXTRA_KEYS = ["nickname", "employmentType", "breakMinutes", "otApprover", "otReason", "workMode", "editor"] as const;

const dash = (v: string | number | undefined) => v == null || v === "" || v === "-";

const VIRTUAL: Record<string, { label: string; from: string[]; value: (row: Row) => string | number }> = {
  shift: {
    label: "กะงาน",
    from: ["shiftStart", "shiftEnd"],
    value: (r) => (dash(r.shiftStart) && dash(r.shiftEnd) ? "-" : `${r.shiftStart}–${r.shiftEnd}`),
  },
  place: {
    label: "สถานที่ / ระยะห่าง",
    from: ["location", "distance"],
    value: (r) => {
      if (dash(r.location)) return "-";
      return dash(r.distance) ? r.location : `${r.location} (${r.distance} ม.)`;
    },
  },
};

export const DAILY_EXTRA_COUNT = EXTRA_KEYS.length;

export function buildDailyColumns(columns: ReportColumn[], showExtra: boolean): DisplayColumn[] {
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const used = new Set<string>();

  const resolve = (key: string): DisplayColumn | null => {
    const virtual = VIRTUAL[key];
    if (virtual) {
      if (!virtual.from.every((k) => byKey.has(k))) return null;
      virtual.from.forEach((k) => used.add(k));
      return { key, label: virtual.label, value: virtual.value };
    }
    const real = byKey.get(key);
    if (!real) return null;
    used.add(key);
    return real;
  };

  const main = MAIN_KEYS.map(resolve).filter((c): c is DisplayColumn => c !== null);
  if (!showExtra) return main;

  const extra = EXTRA_KEYS.map(resolve).filter((c): c is DisplayColumn => c !== null);
  // Anything the service adds later that is not listed above is still shown.
  const unknown = columns.filter((c) => !used.has(c.key));
  return [...main, ...extra, ...unknown];
}

/** Text shown under the enlarged photo: who, when, where. */
export function dailyPhotoPreview(row: Row, columnKey: string, url: string): PhotoPreview {
  const isIn = columnKey === "clockInPhoto";
  const time = isIn ? row.clockIn : row.clockOut;
  const place =
    dash(row.location) ? null : dash(row.distance) ? String(row.location) : `${row.location} (${row.distance} ม.)`;
  return {
    url,
    title: isIn ? "รูปเช็คอิน" : "รูปเช็คเอาท์",
    lines: [`${row.name} (${row.code})`, `${row.date} · ${isIn ? "เข้า" : "ออก"} ${time ?? "-"} น.`, ...(place ? [place] : [])],
  };
}
