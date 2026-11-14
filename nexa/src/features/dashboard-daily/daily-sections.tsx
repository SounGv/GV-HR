import Link from "next/link";
import { CalendarDays, LogOut, Timer } from "lucide-react";

import { FollowRow, FollowRowFailed } from "@/features/dashboard/follow-up";
import { STATUS_META } from "@/features/attendance-status/status-meta";
import type { AccessClaims } from "@/lib/auth/jwt";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "@/components/shared/person-avatar";
import {
  loadMeetingsToday,
  LATE_FIRST_SCAN_MIN,
  loadMissedScans,
  loadOvertimeToday,
  type MeetingToday,
  type MissedScanOut,
  type MissedScans,
  type OvertimeToday,
} from "./service";

const SHOWN = 5;


/** "2026-10-19" → "19 ต.ค." (a Bangkok calendar day, so format in UTC). */
const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/** Each card is one row of the dashboard's "ต้องตามวันนี้" list; it opens to the names. */
function Frame({
  icon,
  title,
  hint,
  count,
  children,
  link,
  tone,
  tag,
  unit,
  order,
  people,
}: {
  icon: typeof Timer;
  title: string;
  hint: string;
  count: number;
  children: React.ReactNode;
  link: { href: string; label: string };
  tone: "bad" | "warn" | "info";
  tag: string;
  unit: string;
  order: number;
  people?: (string | { name: string; avatarUrl?: string | null })[];
}) {
  return (
    <FollowRow icon={icon} title={title} sub={hint} count={count} unit={unit} tone={tone} tag={tag} order={order} link={link} people={people}>
      {children}
    </FollowRow>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-muted-foreground">{children}</p>;
}

function Person({ name, sub, tag, gender, seed, avatarUrl }: { name: string; sub: string; tag?: React.ReactNode; gender?: string | null; seed?: string; avatarUrl?: string | null }) {
  return (
    <li className="gv-row -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5">
      <PersonAvatar name={name} gender={gender} seed={seed} src={avatarUrl} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-snug font-semibold break-words text-foreground">{name}</span>
        <span className="block text-xs text-muted-foreground tabular-nums">{sub}</span>
      </span>
      {tag}
    </li>
  );
}

function More({ total }: { total: number }) {
  return total > SHOWN ? <p className="text-sm text-muted-foreground">และอีก {total - SHOWN} รายการ</p> : null;
}

/** One kind of scan problem inside the ลืมสแกน card: a status chip with a word, then the names. */
function ScanGroup({ label, why, bad, rows, sub }: { label: string; why: string; bad?: boolean; rows: MissedScanOut[]; sub: (r: MissedScanOut) => string }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1 py-1.5">
      <p className="flex flex-wrap items-center gap-2 text-xs leading-relaxed text-muted-foreground">
        <span className={cn("rounded-full border px-2 py-0.5 font-semibold", bad ? STATUS_META.ABSENT.surface : STATUS_META.LATE.surface)}>
          {bad ? "✕" : "!"} {label} {rows.length}
        </span>
        {why}
      </p>
      <ul>
        {rows.slice(0, SHOWN).map((r) => (
          <Person
            key={r.recordId}
            name={r.name}
            gender={r.gender}
            avatarUrl={r.avatarUrl}
            seed={r.employeeId}
            sub={`${r.department} · ${sub(r)}`}
            tag={
              <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums", STATUS_META.LATE.surface)}>
                {fmtDay(r.dayIso)}
              </span>
            }
          />
        ))}
      </ul>
      <More total={rows.length} />
    </div>
  );
}

/**
 * Scans that need a time fix on a recent day, in three kinds (owner's approved
 * mock, 13 Nov 2026): no scan-out, first scan hours after the shift start
 * (likely a forgotten morning scan, still counted late until fixed), and a
 * scan-out before the scan-in. Hours stay blank or wrong until the time is fixed.
 */
export function MissedScanOutCard({ data }: { data: MissedScans }) {
  const all = [...data.noClockOut, ...data.lateFirstScan, ...data.outBeforeIn];
  const hours = LATE_FIRST_SCAN_MIN / 60;
  return (
    <Frame
      icon={LogOut}
      title="ลืมสแกน"
      hint={`${data.days} วันล่าสุด · ไม่นับวันนี้ · ชั่วโมงยังผิดจนกว่าจะแก้เวลา`}
      people={all.map((r) => ({ name: r.name, avatarUrl: r.avatarUrl }))}
      count={all.length}
      tone={data.outBeforeIn.length ? "bad" : "warn"}
      tag="รอแก้เวลา"
      unit="รายการ"
      order={3}
      link={{ href: "/attendance/corrections", label: "ไปหน้าแก้ไขเวลา" }}
    >
      {all.length === 0 ? (
        <Empty>ทุกคนสแกนครบ</Empty>
      ) : (
        <>
          <ScanGroup label="สแกนเข้า ไม่สแกนออก" why="ชั่วโมงทำงานยังคิดไม่ได้" rows={data.noClockOut} sub={(r) => `เข้า ${r.clockIn} น. · ออก -`} />
          <ScanGroup
            label="สแกนครั้งแรกตอนบ่าย"
            why={`เข้าหลังเวลาเข้างานเกิน ${hours} ชม. ตรวจว่าลืมสแกนเข้าไหม ตอนนี้ยังนับเป็นสาย`}
            rows={data.lateFirstScan}
            sub={(r) => `เข้างาน ${r.shiftStart} · สแกนแรก ${r.clockIn} · ออก ${r.clockOut}`}
          />
          <ScanGroup label="เวลาออกก่อนเวลาเข้า" why="ข้อมูลผิด ต้องแก้" bad rows={data.outBeforeIn} sub={(r) => `เข้า ${r.clockIn} · ออก ${r.clockOut}`} />
        </>
      )}
    </Frame>
  );
}

/** Who is down to work overtime tonight, waiting for a decision or already approved. */
export function OvertimeTodayCard({ rows }: { rows: OvertimeToday[] }) {
  const hours = Math.round(rows.reduce((s, r) => s + r.hours, 0) * 10) / 10;
  const waiting = rows.filter((r) => r.status !== "APPROVED").length;
  return (
    <Frame
      icon={Timer}
      title="OT วันนี้"
      hint={`รวม ${hours} ชม.`}
      people={rows.map((r) => ({ name: r.name, avatarUrl: r.avatarUrl }))}
      count={rows.length}
      tone={waiting ? "warn" : "info"}
      tag={waiting ? `รออนุมัติ ${waiting}` : "อนุมัติครบแล้ว"}
      unit="คน"
      order={4}
      link={{ href: "/overtime", label: "ดูคำขอ OT ทั้งหมด" }}
    >
      {rows.length === 0 ? (
        <Empty>วันนี้ยังไม่มีใครขอ OT</Empty>
      ) : (
        <ul>
          {rows.slice(0, SHOWN).map((r) => (
            <Person
              key={r.requestId}
              name={r.name}
              gender={r.gender}
              avatarUrl={r.avatarUrl}
              seed={r.employeeId}
              sub={`${r.startTime}–${r.endTime} น. · ${r.hours} ชม.`}
              tag={
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold",
                    r.status === "APPROVED" ? STATUS_META.NORMAL.surface : STATUS_META.NOT_YET.surface,
                  )}
                >
                  {r.status === "APPROVED" ? "อนุมัติแล้ว" : "รออนุมัติ"}
                </span>
              }
            />
          ))}
        </ul>
      )}
      <More total={rows.length} />
    </Frame>
  );
}

/** The caller's own meetings today. */
export function MeetingsTodayCard({ rows }: { rows: MeetingToday[] }) {
  return (
    <Frame
      icon={CalendarDays}
      title="ประชุมวันนี้"
      hint={rows[0]?.title ?? ""}
      count={rows.length}
      tone="info"
      tag={rows.length ? `ถัดไป ${rows[0].start} น.` : ""}
      unit="นัด"
      order={8}
      link={{ href: "/meetings", label: "ดูนัดประชุมทั้งหมด" }}
    >
      {rows.length === 0 ? (
        <Empty>วันนี้ไม่มีนัดประชุม</Empty>
      ) : (
        <ul>
          {rows.slice(0, SHOWN).map((m) => (
            <li key={m.id} className="gv-row -mx-2 rounded-lg px-2 py-2">
              <Link href={`/meetings/${m.id}`} className="block hover:underline">
                <span className="block text-sm font-semibold break-words text-foreground">{m.title}</span>
                <span className="block text-sm text-muted-foreground tabular-nums">
                  {m.start}–{m.end} น.{m.location ? ` · ${m.location}` : ""} · {m.attendees} คน
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <More total={rows.length} />
    </Frame>
  );
}

/** Async wrappers for `<Suspense>`: each card loads and fails on its own. */
export async function MissedScanOutSection({ companyId, session }: { companyId: string; session: AccessClaims }) {
  try {
    return <MissedScanOutCard data={await loadMissedScans(companyId, session)} />;
  } catch {
    return <FollowRowFailed icon={LogOut} title="ลืมสแกน" what="รายชื่อคนลืมสแกน" order={3} />;
  }
}

export async function OvertimeTodaySection({ companyId, session }: { companyId: string; session: AccessClaims }) {
  try {
    return <OvertimeTodayCard rows={await loadOvertimeToday(companyId, session)} />;
  } catch {
    return <FollowRowFailed icon={Timer} title="OT วันนี้" what="OT วันนี้" order={4} />;
  }
}

export async function MeetingsTodaySection({ companyId, employeeId }: { companyId: string; employeeId: string | undefined }) {
  try {
    return <MeetingsTodayCard rows={await loadMeetingsToday(companyId, employeeId)} />;
  } catch {
    return <FollowRowFailed icon={CalendarDays} title="นัดประชุมวันนี้" what="นัดประชุมวันนี้" order={8} />;
  }
}
