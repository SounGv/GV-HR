import Link from "next/link";
import { CalendarClock, ChevronRight, ClipboardCheck, UserCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_META } from "@/features/attendance-status/status-meta";
import type { AccessClaims } from "@/lib/auth/jwt";
import { cn } from "@/lib/utils";
import {
  loadEvaluationProgress,
  loadProbationDue,
  loadUpcomingLeaves,
  type CampaignProgress,
  type LeavePerson,
  type ProbationDue,
  type UpcomingLeaves,
} from "./service";

const SHOWN = 6;

/** "2026-10-06" → "6 ต.ค." The ISO strings are Bangkok calendar days, so format them in UTC. */
const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

function LoadFailed({ what }: { what: string }) {
  return (
    <Card>
      <CardContent className="py-4 text-sm text-muted-foreground">โหลด{what}ไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง</CardContent>
    </Card>
  );
}

function leaveWhen(p: LeavePerson): string {
  const range = p.startIso === p.endIso ? fmtDay(p.startIso) : `${fmtDay(p.startIso)} – ${fmtDay(p.endIso)}`;
  if (p.hours != null) return `${range} · ${p.hours} ชม.`;
  return p.halfDay ? `${range} · ครึ่งวัน` : range;
}

function LeaveGroup({ title, people, empty }: { title: string; people: LeavePerson[]; empty: string }) {
  return (
    <section aria-label={title} className="space-y-1">
      <h3 className="text-sm font-semibold text-foreground">
        {title} <span className="tabular-nums">({people.length})</span>
      </h3>
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {people.slice(0, SHOWN).map((p) => (
            <li key={p.requestId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
              <span className="min-w-0">
                <span className="block text-sm font-semibold break-words text-foreground">{p.name}</span>
                <span className="block text-sm text-muted-foreground">{p.department}</span>
              </span>
              <span className="flex flex-col items-end gap-0.5 text-right">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
                    STATUS_META.ON_LEAVE.surface,
                  )}
                >
                  {p.typeLabel}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{leaveWhen(p)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {people.length > SHOWN && <p className="text-sm text-muted-foreground">และอีก {people.length - SHOWN} รายการ</p>}
    </section>
  );
}

export function UpcomingLeavesCard({ data }: { data: UpcomingLeaves }) {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-5 shrink-0" aria-hidden="true" /> ใครลาบ้าง
        </CardTitle>
        <p className="text-sm text-muted-foreground">เฉพาะที่อนุมัติแล้ว วันนี้และอีก {data.lookaheadDays} วันข้างหน้า</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <LeaveGroup title="ลาวันนี้" people={data.today} empty="วันนี้ยังไม่มีคนลา" />
        <LeaveGroup title={`เริ่มลาภายใน ${data.lookaheadDays} วัน`} people={data.soon} empty="ยังไม่มีใครลาล่วงหน้า" />
        <Link
          href="/leave?view=overview"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
        >
          ดูคำขอลาทั้งหมด <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}

export function ProbationDueCard({ data }: { data: ProbationDue }) {
  const missing = data.total - data.known;
  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCheck className="size-5 shrink-0" aria-hidden="true" /> ใกล้ครบทดลองงาน
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          ครบภายใน {data.windowDays} วัน ควรประเมินให้เสร็จก่อนวันที่ 120 ของการทำงาน
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.people.length === 0 ? (
          <p className="text-sm text-muted-foreground">ไม่มีใครครบทดลองงานภายใน {data.windowDays} วัน</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.people.slice(0, SHOWN).map((p) => (
              <li key={p.employeeId}>
                <Link
                  href={`/employees/${p.employeeId}`}
                  className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 hover:bg-muted/50"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold break-words text-foreground">{p.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {p.department} · ครบ {fmtDay(p.deadlineIso)}
                      {p.source === "day120" ? " (วันที่ 120)" : ""}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums",
                      p.daysLeft <= 7 ? STATUS_META.LATE.surface : "border-border bg-card text-foreground",
                    )}
                  >
                    {p.daysLeft === 0 ? "ครบวันนี้" : `อีก ${p.daysLeft} วัน`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {data.people.length > SHOWN && <p className="text-sm text-muted-foreground">และอีก {data.people.length - SHOWN} คน</p>}
        {missing > 0 && (
          <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
            ตรวจได้ {data.known} จาก {data.total} คน อีก {missing} คนยังไม่มีวันเริ่มงานหรือวันสิ้นสุดทดลองงานในระบบ
            จึงไม่ถูกนับในรายการนี้ (เพิ่มได้ที่หน้าข้อมูลพนักงาน)
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ProgressRow({ label, tally }: { label: string; tally: CampaignProgress["overall"] }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          ส่งแล้ว {tally.submitted}/{tally.total} ({tally.percent}%)
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={tally.percent}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-[var(--flip7-teal-dark)]" style={{ width: `${tally.percent}%` }} />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        กำลังทำ {tally.inProgress} · ยังไม่เริ่ม {tally.pending}
      </p>
    </div>
  );
}

export function EvaluationProgressCard({ campaigns }: { campaigns: CampaignProgress[] }) {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="size-5 shrink-0" aria-hidden="true" /> ประเมินผลที่ยังค้าง
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {campaigns.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">ตอนนี้ไม่มีรอบประเมินที่เปิดอยู่</p>
            <Link href="/performance" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
              ไปที่เมนูประเมิน <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          campaigns.map((c) => (
            <section key={c.id} aria-label={c.name} className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold break-words text-foreground">
                  {c.name} <span className="font-normal text-muted-foreground">({c.cycle})</span>
                </h3>
                <p className={cn("text-sm", c.daysLeft < 0 ? "font-semibold text-status-late-fg" : "text-muted-foreground")}>
                  ปิดรอบ {fmtDay(c.endIso)} ·{" "}
                  {c.daysLeft < 0 ? `เลยกำหนด ${-c.daysLeft} วัน` : c.daysLeft === 0 ? "ครบวันนี้" : `อีก ${c.daysLeft} วัน`}
                </p>
              </div>
              {c.overall.total === 0 ? (
                <p className="text-sm text-muted-foreground">ไม่มีแบบประเมินของคนในทีมที่คุณดูแลในรอบนี้</p>
              ) : (
                <div className="space-y-3">
                  <ProgressRow label="ทั้งหมด" tally={c.overall} />
                  {c.byRater.length > 1 && c.byRater.map((r) => <ProgressRow key={r.raterType} label={r.label} tally={r.tally} />)}
                </div>
              )}
              <Link
                href={`/performance/campaigns/${c.id}`}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
              >
                ดูรายละเอียดรอบนี้ <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            </section>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/** Async wrappers for `<Suspense>`: each card loads and fails on its own, so one slow or broken query never blanks the dashboard. */
export async function UpcomingLeavesSection({ companyId, session }: { companyId: string; session: AccessClaims }) {
  try {
    return <UpcomingLeavesCard data={await loadUpcomingLeaves(companyId, session)} />;
  } catch {
    return <LoadFailed what="รายชื่อคนลา" />;
  }
}

export async function ProbationDueSection({ companyId, session }: { companyId: string; session: AccessClaims }) {
  try {
    return <ProbationDueCard data={await loadProbationDue(companyId, session)} />;
  } catch {
    return <LoadFailed what="รายชื่อคนใกล้ครบทดลองงาน" />;
  }
}

export async function EvaluationProgressSection({ companyId, session }: { companyId: string; session: AccessClaims }) {
  try {
    return <EvaluationProgressCard campaigns={await loadEvaluationProgress(companyId, session)} />;
  } catch {
    return <LoadFailed what="ความคืบหน้าการประเมิน" />;
  }
}
