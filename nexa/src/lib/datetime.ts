/**
 * Timezone-aware helpers. The platform's operational timezone is Asia/Bangkok;
 * attendance work-dates and lateness are computed in Bangkok time regardless of
 * the server's own timezone.
 */

// Default shift start (09:00). A dedicated Shift module can override this later.
export const SHIFT_START_MIN = 9 * 60;
export const LATE_GRACE_MIN = 0;

export interface BangkokParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  minutesOfDay: number;
  /** UTC midnight of the Bangkok calendar date — safe to store in a @db.Date column. */
  dateUTC: Date;
}

export function bangkokParts(now: Date = new Date()): BangkokParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(now)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  let hour = Number(map.hour);
  const minute = Number(map.minute);
  if (hour === 24) hour = 0; // some environments emit "24" at midnight

  return {
    year,
    month,
    day,
    hour,
    minute,
    minutesOfDay: hour * 60 + minute,
    dateUTC: new Date(Date.UTC(year, month - 1, day)),
  };
}

/** PRESENT if clocked in by the shift start (+grace), otherwise LATE. */
export function lateOrPresent(clockInMinutesOfDay: number): "PRESENT" | "LATE" {
  return clockInMinutesOfDay > SHIFT_START_MIN + LATE_GRACE_MIN ? "LATE" : "PRESENT";
}
