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

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * A 24-hour time picker as two lists, hour and minute, for times that need
 * more precision than half hours (a scan time, an OT finish). Same reason as
 * {@link TimeSelect}: the browser time input shows AM/PM on many phones.
 * Use with a react-hook-form `FormField`: pass `field.value` and `field.onChange`.
 *
 * @param value "HH:mm", or empty while nothing is picked.
 * @param onChange Called with "HH:mm" once both parts are picked.
 * @param minuteStep Minutes between choices (1 for exact times).
 */
export function HourMinuteSelect({
  value,
  onChange,
  onBlur,
  minuteStep = 1,
  className,
  id,
  "aria-invalid": ariaInvalid,
}: {
  value: string | undefined | null;
  onChange: (value: string) => void;
  onBlur?: () => void;
  minuteStep?: number;
  className?: string;
  id?: string;
  "aria-invalid"?: boolean;
}) {
  const [h, m] = (value ?? "").split(":");
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep);
  const set = (hour: string | undefined, minute: string | undefined) => {
    if (hour && minute) onChange(`${hour}:${minute}`);
    else if (hour) onChange(`${hour}:00`);
  };
  return (
    <div className="flex items-center gap-1.5">
      <select
        id={id}
        aria-label="ชั่วโมง"
        aria-invalid={ariaInvalid}
        className={cn("tabular-nums", className)}
        value={h ?? ""}
        onBlur={onBlur}
        onChange={(e) => set(e.target.value, m || "00")}
      >
        <option value="">ชม.</option>
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={pad2(i)}>
            {pad2(i)}
          </option>
        ))}
      </select>
      <span aria-hidden="true">:</span>
      <select
        aria-label="นาที"
        aria-invalid={ariaInvalid}
        className={cn("tabular-nums", className)}
        value={m ?? ""}
        onBlur={onBlur}
        onChange={(e) => set(h || "00", e.target.value)}
      >
        <option value="">นาที</option>
        {/* Keep a stored minute that is not on the step (e.g. 18:31) selectable. */}
        {[...new Set([...minutes.map(pad2), ...(m ? [m] : [])])].sort().map((mm) => (
          <option key={mm} value={mm}>
            {mm}
          </option>
        ))}
      </select>
      <span className="text-sm text-muted-foreground">น.</span>
    </div>
  );
}
