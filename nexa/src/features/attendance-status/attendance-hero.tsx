import Link from "next/link";
import { ArrowDown, CalendarDays, Check, CircleCheck, CircleX, Clock, TriangleAlert, type LucideIcon } from "lucide-react";

import { CountUp } from "@/components/shared/count-up";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { FollowRow } from "@/features/dashboard/follow-up";
import { cn } from "@/lib/utils";
import { StatusRing, personLine } from "./attendance-today-sections";
import { attendanceListHref } from "./status-meta";
import type { TodayStatus } from "./status-rules";
import type { TodayAttendance } from "./types";

interface Props {
  data: TodayAttendance;
  /** Department filter, carried into every link. */
  departmentIds: string[];
}

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

/** One translucent tile on the hero: status, count, a short line; opens that status's list. */
function GlassTile({
  href,
  icon: Icon,
  chip,
  label,
  value,
  unit,
  line,
  bar,
  i,
}: {
  href: string;
  icon: LucideIcon;
  chip: string;
  label: string;
  value: number;
  unit: string;
  line?: string;
  bar?: number;
  i: number;
}) {
  return (
    <Link href={href} className="gv-glass gv-rise block px-4 py-3.5" style={{ "--i": i + 1 } as React.CSSProperties}>
      <span className="flex items-center gap-2 text-[13px] font-semibold text-white/90">
        <span className={cn("flex size-6 items-center justify-center rounded-[7px]", chip)}>
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        {label}
      </span>
      <span className="mt-1.5 block text-[30px] leading-tight font-bold tabular-nums">
        <CountUp value={value} />
        <span className="ml-1 text-xs font-medium text-white/75">{unit}</span>
      </span>
      {bar !== undefined && (
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
          <span className="gv-grow block h-full rounded-full bg-[#CDEB03]" style={{ width: `${bar}%` }} />
        </span>
      )}
      {line && <span className="mt-1 block text-xs text-white/75">{line}</span>}
    </Link>
  );
}

/**
 * Dashboard hero (dashboard-v3-mock.html): today's attendance on the dark
 * teal surface — title, scanned x of y, the status ring and a jump to the
 * follow-up list on the left; four glass tiles (late, absent, leave, on time)
 * on the right, each opening its list.
 */
export function AttendanceHero({ data, departmentIds }: Props) {
  const { counts, total, scanned } = data;
  const late = data.people.filter((p) => p.status === "LATE");
  const worstLate = late.reduce((m, p) => Math.max(m, p.lateMinutes ?? 0), 0);
  const follow = counts.ABSENT + counts.LATE;
  const open = data.isWorkingDay && total > 0;

  return (
    <section aria-label="การเข้างานวันนี้" className="gv-hero gv-rise grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="flex size-11 items-center justify-center rounded-[13px] border border-white/20 bg-white/10">
            <Clock className="size-[22px]" aria-hidden="true" />
          </span>
          <span className="rounded-full bg-[#fde047] px-2.5 py-0.5 text-xs font-bold text-[#3f2d00]">ข้อมูล ณ {data.asOf} น.</span>
        </div>
        <h2 className="mt-4 text-[30px] leading-tight font-bold">การเข้างานวันนี้</h2>
        <p className="mt-1 text-[13.5px] text-white/80">
          {!data.isWorkingDay ? (
            <>วันนี้ไม่ใช่วันทำงาน ({data.nonWorkingReason}) จึงไม่นับสาย ขาด หรือลา</>
          ) : total === 0 ? (
            <>ยังไม่มีพนักงานที่ใช้เช็คอินในแอปในขอบเขตที่เลือก</>
          ) : (
            <>
              สแกนเข้างานแล้ว <b className="tabular-nums">{scanned}</b> จาก <b className="tabular-nums">{total}</b> คน
              {data.notChecked > 0 && <> · ไม่นับ {data.notChecked} คนที่ไม่ใช้แอปสแกน</>}
            </>
          )}
        </p>
        {open && (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="gv-rise" style={{ "--i": 1 } as React.CSSProperties}>
              <StatusRing counts={counts} total={total} scanned={scanned} />
            </div>
            {follow > 0 ? (
              <a
                href="#follow-up"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-[13.5px] font-bold text-[#b91c1c] shadow-[0_0_0_3px_rgba(220,38,38,0.35)] transition-transform hover:-translate-y-px motion-reduce:transition-none"
              >
                <TriangleAlert className="size-4" aria-hidden="true" />
                วันนี้มี {follow} คนขาดหรือสาย
                <ArrowDown className="size-4" aria-hidden="true" />
              </a>
            ) : (
              <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#CDEB03] px-4 text-[13.5px] font-bold text-[#131516]">
                <Check className="size-4" aria-hidden="true" />
                ยังไม่มีคนขาดหรือสาย
              </span>
            )}
          </div>
        )}
      </div>

      {open ? (
        <div className="grid grid-cols-2 gap-3 self-center">
          <GlassTile
            i={0}
            href={attendanceListHref("LATE", departmentIds)}
            icon={Clock}
            chip="bg-[#fde68a] text-[#78350f]"
            label="มาสาย"
            value={counts.LATE}
            unit="คน"
            line={counts.LATE > 0 ? `สายสุด ${worstLate} นาที` : "ยังไม่มีคนมาสาย"}
          />
          <GlassTile
            i={1}
            href={attendanceListHref("ABSENT", departmentIds)}
            icon={CircleX}
            chip="bg-[#fecaca] text-[#7f1d1d]"
            label="ขาดงาน"
            value={counts.ABSENT}
            unit="คน"
            line="ยังไม่สแกนหลังเวลาเข้างาน"
          />
          <GlassTile
            i={2}
            href={attendanceListHref("ON_LEAVE", departmentIds)}
            icon={CalendarDays}
            chip="bg-[#bfdbfe] text-[#1e3a8a]"
            label="ลางาน"
            value={counts.ON_LEAVE}
            unit="คน"
            line="ลาทั้งวันหรือครึ่งวัน"
          />
          <GlassTile
            i={3}
            href={attendanceListHref("NORMAL", departmentIds)}
            icon={CircleCheck}
            chip="bg-[#d9f99d] text-[#365314]"
            label="มาตรงเวลา"
            value={counts.NORMAL}
            unit={`คน · ${pct(counts.NORMAL, total)}%`}
            bar={pct(counts.NORMAL, total)}
            line={counts.NOT_YET > 0 ? `ยังไม่ถึงเวลาเข้างาน ${counts.NOT_YET} คน` : undefined}
          />
        </div>
      ) : (
        <div className="gv-glass self-center px-5 py-6 text-sm text-white/85">
          ดูประวัติการเข้างานย้อนหลังได้ที่เมนูเวลาทำงาน
        </div>
      )}
    </section>
  );
}

const LIVE_ROWS: { status: TodayStatus; icon: LucideIcon; title: string; tone: "bad" | "warn"; tag: string; order: number; empty: string }[] = [
  { status: "ABSENT", icon: CircleX, title: "ขาดงาน", tone: "bad", tag: "ต้องโทรตาม", order: 1, empty: "ยังไม่สแกนและไม่มีใบลา" },
  { status: "LATE", icon: Clock, title: "มาสาย", tone: "warn", tag: "สายวันนี้", order: 2, empty: "วันนี้ยังไม่มีคนมาสาย" },
];

/** The two live rows (absent, late) at the top of "ต้องตามวันนี้"; they refresh with the hero. */
export function AttendanceFollowRows({ data, departmentIds }: Props) {
  const open = data.isWorkingDay && data.total > 0;
  return (
    <>
      {LIVE_ROWS.map((r) => {
        const all = open ? data.people.filter((p) => p.status === r.status) : [];
        const sorted = [...all].sort((a, b) =>
          r.status === "LATE"
            ? (b.lateMinutes ?? 0) - (a.lateMinutes ?? 0)
            : a.shiftStart.localeCompare(b.shiftStart) || a.name.localeCompare(b.name, "th"),
        );
        const names = [...new Set(sorted.map((p) => p.name))];
        const worst = sorted[0]?.lateMinutes ?? 0;
        const sub = r.status === "LATE" ? `สายสุด ${worst} นาที · ${names[0] ?? ""}` : `ยังไม่สแกนและไม่มีใบลา · ${names[0] ?? ""}`;
        return (
          <FollowRow
            key={r.status}
            icon={r.icon}
            title={r.title}
            sub={sub}
            count={all.length}
            unit="คน"
            tone={r.tone}
            tag={r.tag}
            order={r.order}
            people={names}
            link={{ href: attendanceListHref(r.status, departmentIds), label: `ดูทั้งหมด ${all.length} คน` }}
          >
            <ul>
              {sorted.slice(0, 5).map((p) => (
                <li key={p.employeeId} className="gv-row -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                  <PersonAvatar name={p.name} gender={p.gender} seed={p.employeeId} />
                  <span className="min-w-0">
                    <span className="block text-[13px] leading-snug font-semibold break-words text-foreground">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {p.department} · {personLine(p, r.status)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </FollowRow>
        );
      })}
    </>
  );
}
