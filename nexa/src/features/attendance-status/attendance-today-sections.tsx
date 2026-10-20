import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STATUS_META, STATUS_ORDER, attendanceListHref } from "./status-meta";
import type { TodayStatus } from "./status-rules";
import type { TodayAttendance, TodayPerson } from "./types";

interface SectionProps {
  data: TodayAttendance;
  /** Departments chosen in the filter; carried into every link so the filter follows you. */
  departmentIds: string[];
}

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

const RING_COLOR: Record<TodayStatus, string> = {
  NORMAL: "var(--status-normal-dot)",
  LATE: "var(--status-late-dot)",
  ABSENT: "var(--status-absent-dot)",
  ON_LEAVE: "var(--status-leave-dot)",
  NOT_YET: "var(--status-notyet-dot)",
};

/**
 * A small ring split by status, with the share already scanned in the middle.
 * Takes far less room than a full-width line and reads at a glance.
 *
 * @param counts People per status.
 * @param total People counted today.
 * @param scanned People who have scanned in.
 */
function StatusRing({ counts, total, scanned }: { counts: Record<TodayStatus, number>; total: number; scanned: number }) {
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const shown = STATUS_ORDER.filter((s) => counts[s] > 0);
  const gap = shown.length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <div className="relative size-28 shrink-0" role="img" aria-label={`มาแล้ว ${pct(scanned, total)}% · ${STATUS_ORDER.map((s) => `${STATUS_META[s].label} ${counts[s]} คน`).join(" ")}`}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(255 255 255 / 0.18)" strokeWidth="10" />
        {shown.map((s) => {
          const len = (counts[s] / total) * circumference;
          const dash = Math.max(len - gap, 1.5);
          const el = (
            <circle
              key={s}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={RING_COLOR[s]}
              strokeWidth="10"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-2xl leading-none font-bold tabular-nums">{pct(scanned, total)}%</p>
          <p className="mt-1 text-xs">มาแล้ว</p>
        </div>
      </div>
    </div>
  );
}

/**
 * The day split into status pieces: one rounded piece per status with a small
 * gap between them, each as long as its share of people. Pieces grow by count
 * (not a percentage width) so the gaps never push the line past its track.
 *
 * @param counts People per status.
 * @param className Height and track colour.
 * @param link Where a piece goes when tapped; omit for a plain picture.
 */
function SegmentLine({
  counts,
  className,
  link,
}: {
  counts: Record<TodayStatus, number>;
  className?: string;
  link?: (s: TodayStatus) => string;
}) {
  const shown = STATUS_ORDER.filter((s) => counts[s] > 0);
  return (
    <div
      className={cn("flex gap-1", className)}
      role="img"
      aria-label={STATUS_ORDER.map((s) => `${STATUS_META[s].label} ${counts[s]} คน`).join(" ")}
    >
      {shown.map((s) => {
        const piece = cn("h-full min-w-2 basis-0 rounded-full", STATUS_META[s].segment);
        const style = { flexGrow: counts[s] };
        return link ? (
          <Link key={s} href={link(s)} aria-label={`${STATUS_META[s].label} ${counts[s]} คน`} className={piece} style={style} />
        ) : (
          <span key={s} className={piece} style={style} />
        );
      })}
    </div>
  );
}

/** A. "Scanned in X of Y people" with the day split into status segments. Every segment and legend item is a real link. */
export function AttendanceStatusBar({ data, departmentIds }: SectionProps) {
  const { counts, total, scanned } = data;
  return (
    <section className="rounded-2xl bg-[var(--flip7-teal-dark)] p-5 text-white">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm">การเข้างานวันนี้ · ข้อมูล ณ {data.asOf} น.</p>
          <p className="mt-1 text-2xl font-bold">
            สแกนเข้างานแล้ว <span className="tabular-nums">{scanned}</span> จาก{" "}
            <span className="tabular-nums">{total}</span> คน
          </p>

          {!data.isWorkingDay ? (
            <p className="mt-3 text-base">วันนี้ไม่ใช่วันทำงาน ({data.nonWorkingReason}) จึงไม่นับสาย ขาด หรือลา</p>
          ) : total === 0 ? (
            <p className="mt-3 text-base">ยังไม่มีพนักงานที่ใช้เช็คอินในแอปในขอบเขตที่เลือก</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-x-5">
              {STATUS_ORDER.map((s) => (
                <li key={s}>
                  <Link
                    href={attendanceListHref(s, departmentIds)}
                    className="inline-flex min-h-11 items-center gap-2 text-sm hover:underline"
                  >
                    <span className={cn("size-2.5 rounded-full ring-2 ring-white/70", STATUS_META[s].dot)} aria-hidden="true" />
                    {STATUS_META[s].label} <b className="tabular-nums">{counts[s]}</b>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {data.notChecked > 0 && (
            <p className="mt-1 text-sm">
              ไม่นับ {data.notChecked} คนที่ยังไม่เคยใช้เช็คอินในแอป (ไม่ถือว่าขาดงาน)
            </p>
          )}
        </div>
        {data.isWorkingDay && total > 0 && <StatusRing counts={counts} total={total} scanned={scanned} />}
      </div>
    </section>
  );
}

/** B. Compact "follow up today" chips for the middle of the existing approvals strip. */
export function AttendanceFollowChips({ data, departmentIds }: SectionProps) {
  if (!data.isWorkingDay) return null;
  const chips: TodayStatus[] = ["ABSENT", "LATE", "ON_LEAVE"];
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="ต้องตามวันนี้">
      <span className="text-sm">ต้องตามวันนี้</span>
      {chips.map((s) => {
        const Icon = STATUS_META[s].icon;
        return (
          <Link
            key={s}
            href={attendanceListHref(s, departmentIds)}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold",
              STATUS_META[s].surface,
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {STATUS_META[s].label} <span className="tabular-nums">{data.counts[s]}</span>
          </Link>
        );
      })}
    </div>
  );
}

/** C. One tile per status; each opens the matching list. */
export function AttendanceStatusTiles({ data, departmentIds }: SectionProps) {
  if (!data.isWorkingDay || data.total === 0) return null;
  const order: TodayStatus[] = ["NORMAL", "LATE", "ABSENT", "ON_LEAVE", "NOT_YET"];
  return (
    <section aria-label="สถานะการเข้างานวันนี้" className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {order.map((s) => {
        const meta = STATUS_META[s];
        const Icon = meta.icon;
        return (
          <Link
            key={s}
            href={attendanceListHref(s, departmentIds)}
            className={cn("flex min-h-[132px] flex-col justify-between rounded-2xl border p-4 transition hover:brightness-[0.97]", meta.surface)}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Icon className="size-5 shrink-0" aria-hidden="true" /> {meta.label}
            </span>
            <span>
              <span className="block text-4xl leading-none font-bold tabular-nums">{data.counts[s]}</span>
              <span className="mt-1 block text-sm">{pct(data.counts[s], data.total)}% ของทั้งหมด</span>
            </span>
            <span className="inline-flex items-center text-sm font-medium underline-offset-2">
              ดูรายชื่อ <ChevronRight className="size-4" aria-hidden="true" />
            </span>
          </Link>
        );
      })}
    </section>
  );
}

const ATTENTION: { status: TodayStatus; empty: string }[] = [
  { status: "ABSENT", empty: "วันนี้ยังไม่มีคนขาดงาน" },
  { status: "LATE", empty: "วันนี้ยังไม่มีคนมาสาย" },
  { status: "ON_LEAVE", empty: "วันนี้ยังไม่มีคนลา" },
];

function personLine(p: TodayPerson, status: TodayStatus): string {
  if (status === "LATE") return `เข้า ${p.clockIn} น. · สาย ${p.lateMinutes ?? 0} นาที`;
  if (status === "ABSENT") return `ยังไม่สแกน · กะเริ่ม ${p.shiftStart} น.`;
  return "ลางานทั้งวัน";
}

/** D. Three short lists (absent, late, leave) with up to five people each. */
export function AttendanceAttentionCards({ data, departmentIds }: SectionProps) {
  if (!data.isWorkingDay || data.total === 0) return null;
  return (
    <section aria-label="รายชื่อที่ต้องดูวันนี้" className="grid gap-3 md:grid-cols-3">
      {ATTENTION.map(({ status, empty }) => {
        const meta = STATUS_META[status];
        const Icon = meta.icon;
        const all = data.people.filter((p) => p.status === status);
        const sorted = [...all].sort((a, b) =>
          status === "LATE"
            ? (b.lateMinutes ?? 0) - (a.lateMinutes ?? 0)
            : a.shiftStart.localeCompare(b.shiftStart) || a.name.localeCompare(b.name, "th"),
        );
        return (
          <Card key={status} className="gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className={cn("flex size-8 items-center justify-center rounded-full border", meta.surface)}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                {meta.label}
                <span className="ml-auto text-2xl font-bold tabular-nums">{all.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sorted.length === 0 ? (
                <p className="text-sm text-muted-foreground">{empty}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {sorted.slice(0, 5).map((p) => (
                    <li key={p.employeeId} className="py-2">
                      <p className="text-sm font-semibold break-words text-foreground">{p.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.department} · {personLine(p, status)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {all.length > 5 && (
                <Link
                  href={attendanceListHref(status, departmentIds)}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
                >
                  ดูทั้งหมด {all.length} คน <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              )}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

/** F. Department table, most urgent first, with a proportion bar and late/absent/leave tags. */
export function DepartmentBreakdownCard({ data, departmentIds }: SectionProps) {
  if (!data.isWorkingDay || data.total === 0) return null;
  const byDept = new Map<string, { id: string | null; name: string; counts: Record<TodayStatus, number>; total: number }>();
  for (const p of data.people) {
    const d = byDept.get(p.department) ?? {
      id: p.departmentId,
      name: p.department,
      counts: { NORMAL: 0, LATE: 0, ABSENT: 0, ON_LEAVE: 0, NOT_YET: 0 },
      total: 0,
    };
    d.counts[p.status]++;
    d.total++;
    byDept.set(p.department, d);
  }
  const rows = [...byDept.values()].sort(
    (a, b) => b.counts.ABSENT - a.counts.ABSENT || b.counts.LATE - a.counts.LATE || a.name.localeCompare(b.name, "th"),
  );
  const tags: TodayStatus[] = ["ABSENT", "LATE", "ON_LEAVE"];
  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle className="text-base">แยกตามแผนก</CardTitle>
      </CardHeader>
      <CardContent>
        {/* One shared set of columns for every row (subgrid), so each line starts and ends at the same place. */}
        <ul className="grid gap-x-5 divide-y divide-border md:grid-cols-[minmax(0,1fr)_minmax(8rem,14rem)_5.5rem_minmax(0,16rem)]">
          {rows.map((d) => (
            <li key={d.name} className="py-3 md:col-span-4 md:grid md:grid-cols-subgrid">
              <Link
                href={attendanceListHref("all", d.id ? [d.id] : departmentIds)}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-lg hover:bg-muted/40 md:col-span-4 md:grid-cols-subgrid"
              >
                <span className="min-w-0 text-sm font-semibold break-words text-foreground">
                  {d.name} <span className="font-normal text-muted-foreground">({d.total} คน)</span>
                </span>
                <SegmentLine counts={d.counts} className="order-3 col-span-2 h-2.5 md:order-none md:col-span-1" />
                <span className="text-right text-xs text-muted-foreground tabular-nums">
                  มาแล้ว <b className="text-foreground">{d.counts.NORMAL + d.counts.LATE}</b>/{d.total}
                </span>
                <span className="order-4 col-span-2 flex flex-wrap gap-1.5 md:order-none md:col-span-1 md:justify-end">
                  {tags.map((s) => {
                    const Icon = STATUS_META[s].icon;
                    return d.counts[s] > 0 ? (
                      <span
                        key={s}
                        className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold", STATUS_META[s].surface)}
                      >
                        <Icon className="size-3.5" aria-hidden="true" />
                        {STATUS_META[s].label} {d.counts[s]}
                      </span>
                    ) : null;
                  })}
                  {tags.every((s) => d.counts[s] === 0) && (
                    <span className="text-xs text-muted-foreground">ไม่มีสาย ขาด หรือลา</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
