import Link from "next/link";
import { CalendarDays, LogOut, Timer } from "lucide-react";

import { FollowRow, FollowRowFailed } from "@/features/dashboard/follow-up";
import { STATUS_META } from "@/features/attendance-status/status-meta";
import type { AccessClaims } from "@/lib/auth/jwt";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "@/components/shared/person-avatar";
import {
  loadMeetingsToday,
  loadMissedScanOuts,
  loadOvertimeToday,
  type MeetingToday,
  type MissedScanOut,
  type OvertimeToday,
} from "./service";

const SHOWN = 5;

/** "ก · ข และอีก 3 คน": the first two names for a row's one-line summary (duplicates folded). */
export function namesLine(names: string[]): string {
  const uniq = [...new Set(names)];
  const head = uniq.slice(0, 2).join(" · ");
  return uniq.length > 2 ? `${head} และอีก ${uniq.length - 2} คน` : head;
}

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
}) {
  return (
    <FollowRow icon={icon} title={title} sub={hint} count={count} unit={unit} tone={tone} tag={tag} order={order} link={link}>
      {children}
    </FollowRow>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-muted-foreground">{children}</p>;
}

function Person({ name, sub, tag }: { name: string; sub: string; tag?: React.ReactNode }) {
  return (
    <li className="gv-row -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5">
      <PersonAvatar name={name} />
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

/** People who scanned in but not out on a recent day — their hours stay blank until the time is fixed. */
export function MissedScanOutCard({ rows, days }: { rows: MissedScanOut[]; days: number }) {
  return (
    <Frame
      icon={LogOut}
      title={`ลืมสแกนออก (${days} วันล่าสุด)`}
      hint={rows.length ? `${namesLine(rows.map((r) => r.name))} · ชั่วโมงยังว่างจนกว่าจะแก้เวลา` : "ทุกคนสแกนออกครบ"}
      count={rows.length}
      tone="warn"
      tag="รอแก้เวลา"
      unit="รายการ"
      order={3}
      link={{ href: "/attendance/corrections", label: "ไปหน้าแก้ไขเวลา" }}
    >
      {rows.length === 0 ? (
        <Empty>ทุกคนสแกนออกครบ</Empty>
      ) : (
        <ul>
          {rows.slice(0, SHOWN).map((r) => (
            <Person
              key={r.recordId}
              name={r.name}
              sub={`${r.department} · เข้า ${r.clockIn} น.`}
              tag={
                <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums", STATUS_META.LATE.surface)}>
                  {fmtDay(r.dayIso)}
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

/** Who is down to work overtime tonight, waiting for a decision or already approved. */
export function OvertimeTodayCard({ rows }: { rows: OvertimeToday[] }) {
  const hours = Math.round(rows.reduce((s, r) => s + r.hours, 0) * 10) / 10;
  const waiting = rows.filter((r) => r.status !== "APPROVED").length;
  return (
    <Frame
      icon={Timer}
      title="OT วันนี้"
      hint={rows.length ? `รวม ${hours} ชม.${waiting ? ` · รออนุมัติ ${waiting} รายการ` : " · อนุมัติครบแล้ว"}` : "วันนี้ยังไม่มีใครขอ OT"}
      count={rows.length}
      tone={waiting ? "warn" : "info"}
      tag={waiting ? "รออนุมัติ" : "อนุมัติแล้ว"}
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
      title="นัดประชุมวันนี้"
      hint={rows.length ? `ถัดไป ${rows[0].start} น. · ${rows[0].title}` : "วันนี้ไม่มีนัดประชุม"}
      count={rows.length}
      tone="info"
      tag="ข้อมูล"
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
    const data = await loadMissedScanOuts(companyId, session);
    return <MissedScanOutCard rows={data.rows} days={data.days} />;
  } catch {
    return <FollowRowFailed icon={LogOut} title="ลืมสแกนออก" what="รายชื่อคนลืมสแกนออก" order={3} />;
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
