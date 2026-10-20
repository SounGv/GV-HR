import Link from "next/link";
import { CalendarDays, ChevronRight, LogOut, Timer } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_META } from "@/features/attendance-status/status-meta";
import type { AccessClaims } from "@/lib/auth/jwt";
import { cn } from "@/lib/utils";
import {
  loadMeetingsToday,
  loadMissedScanOuts,
  loadOvertimeToday,
  type MeetingToday,
  type MissedScanOut,
  type OvertimeToday,
} from "./service";

const SHOWN = 5;

/** "2026-10-19" → "19 ต.ค." (a Bangkok calendar day, so format in UTC). */
const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

function Frame({
  icon: Icon,
  title,
  hint,
  count,
  children,
  link,
}: {
  icon: typeof Timer;
  title: string;
  hint: string;
  count: number;
  children: React.ReactNode;
  link: { href: string; label: string };
}) {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-5 shrink-0" aria-hidden="true" /> {title}
          <span className="ml-auto text-xl font-bold tabular-nums">{count}</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {children}
        <Link href={link.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
          {link.label} <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-muted-foreground">{children}</p>;
}

function Person({ name, sub, tag }: { name: string; sub: string; tag?: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="block text-sm font-semibold break-words text-foreground">{name}</span>
        <span className="block text-sm text-muted-foreground tabular-nums">{sub}</span>
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
      title="ลืมสแกนออก"
      hint={`${days} วันล่าสุด ไม่นับวันนี้ · ชั่วโมงทำงานยังว่างจนกว่าจะแก้เวลา`}
      count={rows.length}
      link={{ href: "/attendance/corrections", label: "ไปหน้าแก้ไขเวลา" }}
    >
      {rows.length === 0 ? (
        <Empty>ทุกคนสแกนออกครบ</Empty>
      ) : (
        <ul className="divide-y divide-border">
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
  return (
    <Frame
      icon={Timer}
      title="OT วันนี้"
      hint={rows.length ? `รวม ${hours} ชม. · ทั้งที่รออนุมัติและอนุมัติแล้ว` : "คำขอ OT ของวันนี้ ทั้งที่รออนุมัติและอนุมัติแล้ว"}
      count={rows.length}
      link={{ href: "/overtime", label: "ดูคำขอ OT ทั้งหมด" }}
    >
      {rows.length === 0 ? (
        <Empty>วันนี้ยังไม่มีใครขอ OT</Empty>
      ) : (
        <ul className="divide-y divide-border">
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
      hint="ที่คุณนัดหรือได้รับเชิญ"
      count={rows.length}
      link={{ href: "/meetings", label: "ดูนัดประชุมทั้งหมด" }}
    >
      {rows.length === 0 ? (
        <Empty>วันนี้ไม่มีนัดประชุม</Empty>
      ) : (
        <ul className="divide-y divide-border">
          {rows.slice(0, SHOWN).map((m) => (
            <li key={m.id} className="py-2">
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

function LoadFailed({ what }: { what: string }) {
  return (
    <Card>
      <CardContent className="py-4 text-sm text-muted-foreground">โหลด{what}ไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง</CardContent>
    </Card>
  );
}

/** Async wrappers for `<Suspense>`: each card loads and fails on its own. */
export async function MissedScanOutSection({ companyId, session }: { companyId: string; session: AccessClaims }) {
  try {
    const data = await loadMissedScanOuts(companyId, session);
    return <MissedScanOutCard rows={data.rows} days={data.days} />;
  } catch {
    return <LoadFailed what="รายชื่อคนลืมสแกนออก" />;
  }
}

export async function OvertimeTodaySection({ companyId, session }: { companyId: string; session: AccessClaims }) {
  try {
    return <OvertimeTodayCard rows={await loadOvertimeToday(companyId, session)} />;
  } catch {
    return <LoadFailed what="OT วันนี้" />;
  }
}

export async function MeetingsTodaySection({ companyId, employeeId }: { companyId: string; employeeId: string | undefined }) {
  try {
    return <MeetingsTodayCard rows={await loadMeetingsToday(companyId, employeeId)} />;
  } catch {
    return <LoadFailed what="นัดประชุมวันนี้" />;
  }
}
