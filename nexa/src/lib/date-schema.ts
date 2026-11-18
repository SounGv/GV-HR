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
