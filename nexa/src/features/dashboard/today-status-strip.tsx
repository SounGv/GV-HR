import type { ReactNode } from "react";
import { stackPercents } from "./chart-math";

const NOT_YET_FILL = "repeating-linear-gradient(135deg, var(--chart-muted-bar) 0 5px, var(--status-notyet-dot) 5px 7px)";

/**
 * หน้าหลัก status line (approved mock charts-placement-mock.html): today's figures
 * in words, then one stacked bar of on time / late / leave / not yet, then the key
 * with the same numbers, so the colours never carry meaning on their own.
 */
export function TodayStatusStrip({
  onTime,
  late,
  leave,
  notYet,
  links,
}: {
  onTime: number;
  late: number;
  leave: number;
  notYet: number;
  links?: ReactNode;
}) {
  const total = onTime + late + leave + notYet;
  const parts = [
    { key: "on", label: "ตรงเวลา", n: onTime, fill: "var(--series-highlight)" },
    { key: "late", label: "สาย", n: late, fill: "var(--status-late-dot)" },
    { key: "leave", label: "ลา", n: leave, fill: "var(--status-leave-dot)" },
    { key: "notyet", label: "ยังไม่ลงเวลา", n: notYet, fill: NOT_YET_FILL },
  ];
  const widths = stackPercents(parts.map((p) => p.n));
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 text-[15px]">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <span>
          วันนี้ลงเวลาแล้ว <b className="tabular-nums">{onTime + late}</b> จาก <b className="tabular-nums">{total}</b> คน
        </span>
        <span>
          สาย <b className="tabular-nums">{late}</b>
        </span>
        <span>
          ลา <b className="tabular-nums">{leave}</b>
        </span>
        {links && <span className="ml-auto flex flex-wrap gap-x-5 gap-y-1">{links}</span>}
      </div>
      {total > 0 && (
        <>
          <div
            className="flex h-3.5 gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={parts.map((p) => `${p.label} ${p.n}`).join(" ") + ` จาก ${total} คน`}
          >
            {parts.map((p, i) =>
              p.n > 0 ? <span key={p.key} className="block h-full" style={{ width: `${widths[i]}%`, background: p.fill }} /> : null,
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13.5px]">
            {parts.map((p) => (
              <span key={p.key} className="inline-flex items-center gap-1.5">
                <i className="inline-block size-2.5 rounded-[3px]" style={{ background: p.fill }} aria-hidden="true" />
                {p.label} <b className="tabular-nums">{p.n}</b>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
