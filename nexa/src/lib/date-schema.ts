import { z } from "zod";

/** Earliest and latest year a form date may have. Anything outside is a typing slip, not a real date. */
export const MIN_DATE_YEAR = 1900;
export const MAX_DATE_YEAR = 2100;

/**
 * Date field for forms and query strings: z.coerce.date() plus a sane year range.
 *
 * Without the range a Buddhist-era year typed into a date box (2569 instead of 2026) is accepted and
 * saved 543 years ahead, which already happened to a hire date and an attendance record. A year over
 * 2400 gets a message that names the cause so the person fixes it instead of retrying.
 */
export const calendarDate = (params?: { message?: string }) =>
  z.preprocess(unrollDay, calendarDateInner(params));

/**
 * "2026-02-30" is not a day, but JavaScript reads it as 2 March. Text that looks like a date and does not exist is
 * turned into something that fails to parse, so the field's own message shows instead of a silently moved date.
 */
function unrollDay(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return v;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const real = new Date(Date.UTC(y, mo - 1, d));
  return real.getUTCFullYear() === y && real.getUTCMonth() === mo - 1 && real.getUTCDate() === d ? v : "not a date";
}

const calendarDateInner = (params?: { message?: string }) =>
  z.coerce.date(params).refine(
    (d) => {
      const y = d.getUTCFullYear();
      return y >= MIN_DATE_YEAR && y <= MAX_DATE_YEAR;
    },
    {
      error: (issue) => {
        const input = issue.input;
        const y = input instanceof Date ? input.getUTCFullYear() : NaN;
        return y > 2400
          ? "ปีต้องเป็น ค.ศ. เช่น 2026 ไม่ใช่ พ.ศ."
          : `ปีต้องอยู่ระหว่าง ${MIN_DATE_YEAR} ถึง ${MAX_DATE_YEAR}`;
      },
    },
  );
