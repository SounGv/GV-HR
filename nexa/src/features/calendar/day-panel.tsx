"use client";

import { STATUS_META } from "@/features/attendance-status/status-meta";
import type { TodayStatus } from "@/features/attendance-status/status-rules";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { CalendarDayAttendance, CalendarDayPerson, CalendarItem } from "./types";

const SHOWN: TodayStatus[] = ["ABSENT", "ON_LEAVE", "LATE"];

/**
 * Solid fills for the three head-count statuses, shared by the calendar cell chips, the key line and the day tiles.
 * Strong text on a solid colour (not a tint); the word is always printed next to it, so colour is never the only signal.
 * The arbitrary blue has its own dark counterpart because no theme token is dark enough for white text.
 */
export const SOLID_STATUS: Record<"ABSENT" | "ON_LEAVE" | "LATE", string> = {
  ABSENT: "border-destructive bg-destructive text-destructive-foreground",
  ON_LEAVE: "border-[#1565c0] bg-[#1565c0] text-white dark:border-[#7fb2f5] dark:bg-[#7fb2f5] dark:text-[#0b1a2e]",
  LATE: "border-status-late-dot bg-status-late-dot text-[#3a2a00]",
};

/** First letter of a Thai or Latin name for the avatar circle, skipping leading vowels that are not a letter on their own. */
function initialOf(name: string): string {
  return Array.from(name.trim()).find((ch) => !/[เแโใไ]/.test(ch)) ?? "?";
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1565c0] text-[13px] font-bold text-white dark:bg-[#7fb2f5] dark:text-[#0b1a2e]"
      aria-hidden="true"
    >
      {initialOf(name)}
    </span>
  );
}

const GROUP_HELP: Record<string, string> = {
  ABSENT: "ไม่มีบันทึกเข้างาน และไม่มีใบลาที่อนุมัติ",
  ON_LEAVE: "มีใบลาที่อนุมัติแล้ว",
  LATE: "เข้างานหลังเวลา",
};

const MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const WEEKDAYS_FULL = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

/** "2569-11-05" -> "พฤหัสบดีที่ 5 พฤศจิกายน 2569". */
export function dayLabel(iso: string): string {
  const weekday = WEEKDAYS_FULL[new Date(`${iso}T00:00:00Z`).getUTCDay()];
  return `${weekday}ที่ ${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(0, 4)) + 543}`;
}

/** "ลา — ชื่อ" (a leave bar on the calendar) -> "ชื่อ". */
const leaveName = (it: CalendarItem) => it.title.replace(/^ลา\s*—\s*/, "");

/**
 * The clicked day, said plainly: how many people are absent, on leave and late, each in its own colour with an icon and a word
 * (never colour alone), then who they are. People who may see attendance get all three from the attendance rules; everyone else
 * gets only the approved leave already on the calendar.
 */
export function DayPanel({
  label,
  loading,
  day,
  leaveItems,
  solid = false,
}: {
  /** From dayLabel(). */
  label: string;
  loading: boolean;
  /** Present for people who may see attendance. */
  day: CalendarDayAttendance | null | undefined;
  /** Approved leave on that day from the month list (the only data everyone may see). */
  leaveItems: CalendarItem[];
  /** Desktop calendar look: solid tiles for counts above zero and an avatar before each name. Off for the phone calendar. */
  solid?: boolean;
}) {
  const leaveNames = [...new Set(leaveItems.map(leaveName))];

  return (
    <div className="space-y-3" data-testid="day-panel">
      <p className="text-sm font-semibold">{label}</p>

      {loading ? (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : day && !day.isFuture ? (
        <AttendanceBody day={day} solid={solid} />
      ) : (
        <LeaveOnlyBody names={leaveNames} future={!!day?.isFuture} solid={solid} />
      )}
    </div>
  );
}

/** The grey line beside a person: clock-in and minutes late for the late group, the department for everyone else. */
function personNote(status: TodayStatus, p: CalendarDayPerson): string {
  return status === "LATE" && p.clockIn ? `เข้า ${p.clockIn}${p.lateMinutes ? ` · สาย ${p.lateMinutes} นาที` : ""}` : p.department;
}

function CountTile({ status, count, solid }: { status: TodayStatus; count: number; solid: boolean }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  if (solid) {
    // Solid when there are people, plain white when zero so the empty tiles do not compete with the full ones.
    const filled = count > 0 && (status === "ABSENT" || status === "ON_LEAVE" || status === "LATE");
    return (
      <div
        className={cn(
          "rounded-lg border px-2.5 py-2",
          filled ? SOLID_STATUS[status as "ABSENT" | "ON_LEAVE" | "LATE"] : "border-border bg-card text-foreground",
        )}
      >
        <div className="flex items-center gap-1.5 text-[13px] font-semibold">
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
          {meta.label}
        </div>
        <p className="text-[26px] leading-[1.3] font-bold tabular-nums">
          {count}
          <span className="ml-1 text-[13px] font-medium">คน</span>
        </p>
      </div>
    );
  }
  return (
    <div className={cn("rounded-lg border px-3 py-2", meta.surface, count === 0 && "opacity-60")}>
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {meta.label}
      </div>
      <p className="mt-0.5 text-2xl leading-none font-bold tabular-nums">
        {count}
        <span className="ml-1 text-xs font-medium">คน</span>
      </p>
    </div>
  );
}

function AttendanceBody({ day, solid }: { day: CalendarDayAttendance; solid: boolean }) {
  if (!day.isWorkingDay) {
    return (
      <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        {day.nonWorkingReason ?? "วันหยุด"} — ไม่นับขาด ลา สาย
      </p>
    );
  }
  if (day.total === 0) {
    return <p className="text-sm text-muted-foreground">ไม่มีข้อมูลการลงเวลาของวันนี้</p>;
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <CountTile status="ABSENT" count={day.counts.ABSENT} solid={solid} />
        <CountTile status="ON_LEAVE" count={day.counts.ON_LEAVE} solid={solid} />
        <CountTile status="LATE" count={day.counts.LATE} solid={solid} />
      </div>
      <p className={solid ? "rounded-lg bg-muted px-3 py-2 text-sm text-foreground" : "text-xs text-muted-foreground"}>
        {solid ? <b className="font-bold">มาปกติ {day.counts.NORMAL} คน</b> : <>มาปกติ {day.counts.NORMAL} คน</>} จากทั้งหมด {day.total}{" "}
        คนที่ใช้แอพลงเวลา
        {day.notChecked > 0 &&
          (solid ? (
            <span className="mt-0.5 block text-[13px] text-muted-foreground">ไม่นับ {day.notChecked} คนที่ยังไม่เคยลงเวลา</span>
          ) : (
            ` (ไม่นับ ${day.notChecked} คนที่ยังไม่เคยลงเวลา)`
          ))}
      </p>

      {SHOWN.map((status) => {
        const people = day.people.filter((p) => p.status === status);
        if (people.length === 0) return null;
        const meta = STATUS_META[status];
        const Icon = meta.icon;
        return (
          <section key={status} className={cn("rounded-lg border p-2.5", meta.card)}>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold">
              <span className={cn("size-2 rounded-full", meta.dot)} aria-hidden="true" />
              <Icon className="size-3.5" aria-hidden="true" />
              {meta.label} {people.length} คน
              <span className="font-normal text-muted-foreground">· {GROUP_HELP[status]}</span>
            </h3>
            <ul className="mt-1.5 space-y-1">
              {people.map((p) => (
                <li
                  key={p.employeeId}
                  className={solid ? "flex items-center gap-2.5 py-1 text-sm" : "flex items-baseline justify-between gap-2 text-sm"}
                >
                  {solid ? (
                    <>
                      <Avatar name={p.name} />
                      <div className="min-w-0">
                        <span className="block truncate leading-[1.4] font-semibold">{p.name}</span>
                        <span className="text-[13px] text-muted-foreground">{personNote(status, p)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 truncate font-medium">{p.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{personNote(status, p)}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {day.people.some((p) => p.partialLeave) && (
        <p className="text-xs text-muted-foreground">
          ลาบางส่วน (รายชั่วโมง / ครึ่งวัน) แต่มาทำงาน:{" "}
          {day.people
            .filter((p) => p.partialLeave)
            .map((p) => p.name)
            .join(", ")}
        </p>
      )}
    </div>
  );
}

function LeaveOnlyBody({ names, future, solid }: { names: string[]; future: boolean; solid: boolean }) {
  const meta = STATUS_META.ON_LEAVE;
  const Icon = meta.icon;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <CountTile status="ON_LEAVE" count={names.length} solid={solid} />
      </div>
      {future && (
        <p className="text-xs text-muted-foreground">
          ยังไม่ถึงวันนี้ จึงนับขาดและสายไม่ได้ แสดงเฉพาะคนที่ลาล่วงหน้าและอนุมัติแล้ว
        </p>
      )}
      {names.length > 0 && (
        <section className={cn("rounded-lg border p-2.5", meta.card)}>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold">
            <span className={cn("size-2 rounded-full", meta.dot)} aria-hidden="true" />
            <Icon className="size-3.5" aria-hidden="true" />
            {meta.label} {names.length} คน
            <span className="font-normal text-muted-foreground">· {GROUP_HELP.ON_LEAVE}</span>
          </h3>
          <ul className="mt-1.5 space-y-1">
            {names.map((n) => (
              <li key={n} className={solid ? "flex items-center gap-2.5 py-1 text-sm" : "truncate text-sm font-medium"}>
                {solid ? (
                  <>
                    <Avatar name={n} />
                    <span className="min-w-0 truncate font-semibold">{n}</span>
                  </>
                ) : (
                  n
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
