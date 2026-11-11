"use client";

import { useEffect, useState } from "react";

const fmtDate = new Intl.DateTimeFormat("th-TH", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Asia/Bangkok",
});
const fmtTime = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Bangkok",
});

/**
 * Today's date and the Bangkok time above the sign-in form, ticking each
 * minute. Rendered only after mount so the server's clock never mismatches
 * the browser's on hydration.
 */
export function LoginClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="flex min-h-6 items-center gap-2 text-[13px] text-[var(--login-text-secondary)]">
      {now && (
        <>
          <span className="size-2 rounded-full bg-[#0d9488] shadow-[0_0_0_3px_rgba(13,148,136,0.18)]" aria-hidden="true" />
          {fmtDate.format(now)}
          <span className="font-semibold text-[var(--login-text-primary)] tabular-nums">{fmtTime.format(now)} น.</span>
        </>
      )}
    </p>
  );
}
