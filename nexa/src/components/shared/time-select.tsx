"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/** "00:00", "00:30", … "23:30" — every half hour of the day. */
export const HALF_HOUR_TIMES: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  return `${h}:${i % 2 ? "30" : "00"}`;
});

type TimeSelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  /** Shown as the first, empty choice. */
  placeholder?: string;
};

/**
 * A 24-hour time picker (half-hour steps). The browser's own time input shows
 * AM/PM on many phones, which made people pick 9:00 PM for 9 in the morning;
 * a plain list of "09:00" style times can't be misread. Works with
 * react-hook-form's `register`.
 */
export const TimeSelect = forwardRef<HTMLSelectElement, TimeSelectProps>(function TimeSelect(
  { className, placeholder = "เลือกเวลา", ...props },
  ref,
) {
  return (
    <select ref={ref} className={cn("tabular-nums", className)} {...props}>
      <option value="">{placeholder}</option>
      {HALF_HOUR_TIMES.map((t) => (
        <option key={t} value={t}>
          {t} น.
        </option>
      ))}
    </select>
  );
});
