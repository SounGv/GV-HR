import { Check } from "lucide-react";

import { PersonAvatar } from "@/components/shared/person-avatar";
import { EmptyState, ErrorState } from "@/components/shared/states";
import type { MissedScanOut, MissedScans } from "@/features/dashboard-daily/service";

/** "2026-11-25" → "25 พ.ย." (a Bangkok calendar day, so format in UTC). */
const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

interface Row {
  r: MissedScanOut;
  reason: string;
  detail: string;
}

/**
 * The people behind the "ลืมสแกน" card on the home follow-up board, so the card's button lands on the same list.
 * A time can only be corrected by a request the person files for themselves; once they do, it appears on the
 * "รออนุมัติ" tab. This list is the one to chase before that happens. `data` is null when it failed to load; `lateHours` is the first-scan rule (see LATE_FIRST_SCAN_MIN), passed in because that module reads the database and must not reach the browser.
 */
export function MissedScansTab({ data, lateHours }: { data: MissedScans | null; lateHours: number }) {
  if (!data) return <ErrorState />;

  const rows: Row[] = [
    ...data.noClockOut.map((r) => ({ r, reason: "ลืมสแกนออก", detail: `เข้า ${r.clockIn} น. · ออก -` })),
    ...data.lateFirstScan.map((r) => ({ r, reason: "ลืมสแกนเข้า", detail: `เข้างาน ${r.shiftStart} · สแกนแรก ${r.clockIn} · ออก ${r.clockOut}` })),
    ...data.outBeforeIn.map((r) => ({ r, reason: "เวลาออกก่อนเวลาเข้า", detail: `เข้า ${r.clockIn} · ออก ${r.clockOut}` })),
  ].sort((a, b) => b.r.dayIso.localeCompare(a.r.dayIso));

  if (rows.length === 0) {
    return <EmptyState icon={Check} title="ทุกคนสแกนครบ" description={`ไม่มีใครลืมสแกนใน ${data.days} วันล่าสุด (ไม่นับวันนี้)`} />;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1 text-sm leading-relaxed text-muted-foreground">
        <p>{`เวลาเข้า-ออกที่น่าจะผิดใน ${data.days} วันล่าสุด (ไม่นับวันนี้) ชั่วโมงทำงานของวันนั้นยังคิดไม่ถูกจนกว่าจะแก้`}</p>
        <p>คนที่ลืมต้องกด แก้ไขเวลา ส่งคำขอเอง ตามให้เขาส่งได้เลย พอส่งแล้วคำขอจะขึ้นที่แท็บ รออนุมัติ</p>
        <p>{`สแกนเข้าหลังเวลากะเกิน ${lateHours} ชม. นับว่าน่าจะลืมสแกนเข้า`}</p>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {rows.map(({ r, reason, detail }) => (
          <li key={`${r.recordId}-${reason}`} className="flex items-center gap-3 px-4 py-3">
            <PersonAvatar name={r.name} gender={r.gender} seed={r.employeeId} src={r.avatarUrl} className="size-10 border border-border text-sm font-bold" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] leading-[1.5] font-semibold break-words text-foreground">{r.name}</span>
              <span className="block text-[13px] leading-[1.5] break-words text-muted-foreground">
                {r.department} · {detail}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm leading-[1.5] font-bold tabular-nums text-foreground">{fmtDay(r.dayIso)}</span>
              <span className="block text-[13px] leading-[1.5] text-muted-foreground">{reason}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
