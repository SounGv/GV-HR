import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, CircleAlert, Clock, Lock, Minus, Pencil, PenLine } from "lucide-react";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { GvCalcIcon, GvDraftIcon, GvEvaluationIcon, GvIconTile, type GvIconProps, type GvStatus } from "@/components/shared/gv-icons";
import { SectionHeading } from "@/components/shared/section-heading";
import { cn } from "@/lib/utils";
import type { AccessClaims } from "@/lib/auth/jwt";
import { can } from "@/lib/auth/rbac";
import { loadEvaluationOverview, type EvaluationOverview, type OpenRound, type ResultsCard } from "./evaluation-overview";
import { HrEvalTiles, ResultsBoardCard, TemplateCard } from "./hr-eval-panel";

const CARD = "rounded-lg border border-border bg-card p-4 shadow-[var(--card-shadow)] sm:p-5";
const BTN = "inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:bg-accent";
const BTN_PRIMARY = "inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110";

const fmtDay = (iso: string) => new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

function Bar({ label, value, total, text }: { label: string; value: number; total: number; text: string }) {
  const width = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-2 text-sm">
      <span className="min-w-0 break-words">{label}</span>
      <span className="h-3.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${label} ${text}`}>
        <span className="block h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </span>
      <span className="text-right text-muted-foreground tabular-nums">{text}</span>
    </div>
  );
}

function DaysLeft({ round }: { round: OpenRound }) {
  if (round.daysLeft === null || round.endIso === null) return null;
  const late = round.daysLeft < 0;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-status-late-border bg-status-late-bg px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-status-late-fg">
      <Clock className="size-3.5" aria-hidden="true" />
      {late ? `เลยกำหนด ${Math.abs(round.daysLeft)} วัน` : round.daysLeft === 0 ? "ปิดวันนี้" : `เหลือ ${round.daysLeft} วัน`} · ปิด {fmtDay(round.endIso)}
    </span>
  );
}

function OpenRoundCard({ round, companyWide }: { round: OpenRound; companyWide: boolean }) {
  const s = round.summary;
  return (
    <article className={CARD} aria-label={round.name}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base leading-snug font-semibold break-words">{round.name}</h3>
        <DaysLeft round={round} />
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
        {[
          [s.people.total, companyWide ? "คนที่ถูกประเมิน" : "คนในทีมที่ถูกประเมิน"],
          [s.people.done, "ประเมินครบแล้ว"],
          [s.people.pending, "ยังรอประเมิน"],
        ].map(([n, label]) => (
          <div key={label as string}>
            <dd className="text-[1.75rem] leading-snug font-bold tabular-nums">{n}</dd>
            <dt className="text-sm text-muted-foreground">{label}</dt>
          </div>
        ))}
        <div>
          <dd className="text-[1.75rem] leading-snug font-bold tabular-nums">{s.forms.percentSubmitted}%</dd>
          <dt className="text-sm text-muted-foreground tabular-nums">
            ใบประเมินที่ส่งแล้ว ({s.forms.submitted} จาก {s.forms.total})
          </dt>
        </div>
      </dl>

      {s.forms.total > 0 && (
        <>
          <div className="mt-2 flex h-3.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`ส่งแล้ว ${s.forms.submitted} กำลังทำ ${s.forms.inProgress} ยังไม่เริ่ม ${s.forms.notStarted} จากทั้งหมด ${s.forms.total} ใบ`}>
            <span className="h-full bg-primary" style={{ width: `${(s.forms.submitted / s.forms.total) * 100}%` }} />
            <span className="h-full bg-primary/45" style={{ width: `${(s.forms.inProgress / s.forms.total) * 100}%` }} />
          </div>
          <p className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-muted-foreground tabular-nums">
            <span>ส่งแล้ว {s.forms.submitted}</span>
            <span>กำลังทำ {s.forms.inProgress}</span>
            <span>ยังไม่เริ่ม {s.forms.notStarted}</span>
          </p>
        </>
      )}

      {s.people.pending > 0 && (
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          {companyWide && s.byRater.length > 0 && (
            <section aria-label="ยังไม่ส่ง แยกตามผู้ประเมิน" className="space-y-2">
              <h4 className="text-sm font-semibold">ยังไม่ส่ง แยกตามผู้ประเมิน</h4>
              {s.byRater.map((r) => (
                <Bar key={r.raterType} label={r.label} value={r.total - r.pending} total={r.total} text={`${r.pending} ใบ`} />
              ))}
              <p className="text-xs text-muted-foreground">แถบคือส่วนที่ส่งแล้ว ตัวเลขคือจำนวนใบที่ยังค้าง</p>
            </section>
          )}
          {s.byDepartment.length > 1 && (
            <section aria-label="ยังรอประเมิน แยกตามแผนก" className="space-y-1">
              <h4 className="text-sm font-semibold">ยังรอประเมิน แยกตามแผนก</h4>
              <ul className="divide-y divide-border text-sm">
                {s.byDepartment.slice(0, 6).map((d) => (
                  <li key={d.department} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="min-w-0 break-words">{d.department}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {d.pending} จาก {d.total} คน · ส่งแล้ว {d.percentSubmitted}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {s.pendingPeople.length > 0 && (
        <section aria-label="คนที่ยังรอประเมิน" className="mt-4 space-y-1">
          <h4 className="text-sm font-semibold">
            คนที่ยังรอประเมิน <span className="font-medium text-muted-foreground">(เรียงจากค้างมากที่สุด)</span>
          </h4>
          <ul className="divide-y divide-border">
            {s.pendingPeople.map((p) => (
              <li key={p.employeeId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-2">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold break-words">{p.name}</span>
                  <span className="block text-sm text-muted-foreground">{p.department}</span>
                </span>
                <span className="text-right text-sm">
                  <span className="block">รอ: {p.waiting}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    ส่งแล้ว {p.submitted}/{p.total}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={round.href} className={BTN_PRIMARY}>
          {companyWide ? "ดูรายชื่อคนที่ยังไม่ประเมินทั้งหมด" : "เปิดหน้ารอบนี้"}
        </Link>
      </div>
    </article>
  );
}

function ResultsView({ r }: { r: ResultsCard }) {
  const maxGrade = Math.max(1, ...r.grades.map((g) => g.count));
  return (
    <article className={CARD} aria-label={`ผลประเมิน ${r.roundName}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base leading-snug font-semibold break-words">{r.roundName}</h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-muted px-2.5 py-0.5 text-xs font-semibold text-success">
          <CheckCircle2 className="size-3.5" aria-hidden="true" /> อนุมัติผลแล้ว
        </span>
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <dd className="text-[1.75rem] leading-snug font-bold tabular-nums">{r.average}%</dd>
          <dt className="text-sm text-muted-foreground">คะแนนเฉลี่ย</dt>
          {r.change && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
              {r.change.direction === "up" ? <ArrowUpRight className="size-4 text-success" aria-hidden="true" /> : r.change.direction === "down" ? <ArrowDownRight className="size-4 text-status-late-fg" aria-hidden="true" /> : <Minus className="size-4" aria-hidden="true" />}
              {r.change.direction === "up" ? `เพิ่มขึ้น ${r.change.delta} จุด` : r.change.direction === "down" ? `ลดลง ${Math.abs(r.change.delta)} จุด` : "เท่ารอบก่อน"}
              <span className="font-medium text-muted-foreground"> เทียบ {r.change.previousName}</span>
            </p>
          )}
        </div>
        <div>
          <dd className="text-[1.75rem] leading-snug font-bold tabular-nums">{r.count}</dd>
          <dt className="text-sm text-muted-foreground">คนที่มีผลแล้ว{r.missing > 0 ? ` (อีก ${r.missing} คนยังไม่มีผล)` : ""}</dt>
        </div>
      </dl>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        {r.grades.length > 0 && (
          <section aria-label="การกระจายเกรด" className="space-y-2">
            <h4 className="text-sm font-semibold">การกระจายเกรด</h4>
            {r.grades.map((g) => (
              <Bar key={g.label} label={`เกรด ${g.label}`} value={g.count} total={maxGrade} text={`${g.count} คน`} />
            ))}
          </section>
        )}
        {r.departments.length > 1 && (
          <section aria-label="คะแนนเฉลี่ยแยกแผนก" className="space-y-2">
            <h4 className="text-sm font-semibold">คะแนนเฉลี่ยแยกแผนก</h4>
            {r.departments.slice(0, 6).map((d) => (
              <Bar key={d.department} label={d.department} value={d.average} total={100} text={`${d.average}%`} />
            ))}
          </section>
        )}
      </div>

      {r.showRanking && r.top.length > 0 && (
        <section aria-label="ลำดับคะแนนสูงสุด" className="mt-4 space-y-1">
          <h4 className="text-sm font-semibold">ลำดับคะแนนสูงสุด {r.top.length} อันดับ</h4>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/60 text-left">
                  <th className="px-2.5 py-1.5 font-semibold">ลำดับ</th>
                  <th className="px-2.5 py-1.5 font-semibold">ชื่อ</th>
                  <th className="px-2.5 py-1.5 font-semibold">แผนก</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">คะแนน</th>
                  <th className="px-2.5 py-1.5 font-semibold">เกรด</th>
                </tr>
              </thead>
              <tbody>
                {r.top.map((t, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2.5 py-1.5">
                      <span className={cn("inline-grid size-7 place-items-center rounded-lg text-sm font-bold tabular-nums", t.rank === 1 ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground")}>{t.rank}</span>
                    </td>
                    <td className="px-2.5 py-1.5 break-words">{t.name}</td>
                    <td className="px-2.5 py-1.5">{t.department}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{t.scorePercent}%</td>
                    <td className="px-2.5 py-1.5">{t.grade ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="flex items-start gap-1.5 pt-1 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            แสดงเฉพาะอันดับต้น ลำดับเต็มอยู่ในหน้ารอบประเมิน ซึ่งต้องมีสิทธิ์เข้าถึง
          </p>
        </section>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={r.href} className={BTN_PRIMARY}>
          {r.showRanking ? "ดูผลและลำดับทั้งหมด" : "ดูผลของทีม"}
        </Link>
      </div>
    </article>
  );
}

/** A status word with its icon, never colour alone. */
function StatusPill({ tone, icon: Icon, children }: { tone: "warn" | "info"; icon: typeof Clock; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        tone === "warn" ? "border border-status-late-border bg-status-late-bg text-status-late-fg" : "bg-info/10 text-info",
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}

/** HR's own queue: the evaluation steps only HR can do. One line when there is nothing to do, so the page stays short. */
export function HrWorkCard({ o }: { o: EvaluationOverview }) {
  const rows: { key: string; title: string; sub: string; pill: React.ReactNode; href: string; action: string; icon: React.ComponentType<GvIconProps>; status: GvStatus }[] = [];
  for (const r of o.awaitingReview) {
    rows.push({ key: `review-${r.id}`, title: r.name, sub: "คำนวณผลแล้ว รอทบทวนและอนุมัติ", pill: <StatusPill tone="warn" icon={CircleAlert}>รอทบทวน</StatusPill>, href: r.href, action: "ทบทวนผล", icon: GvEvaluationIcon, status: "warn" });
  }
  if (o.awaitingCalculation) {
    rows.push({ key: "calc", title: o.awaitingCalculation.name, sub: "ปิดรอบแล้ว ยังไม่คำนวณผล", pill: <StatusPill tone="warn" icon={CircleAlert}>รอคำนวณ</StatusPill>, href: o.awaitingCalculation.href, action: "ไปคำนวณผล", icon: GvCalcIcon, status: "warn" });
  }
  for (const d of o.drafts) {
    rows.push({
      key: `draft-${d.id}`,
      title: d.name,
      sub: d.startIso ? `ฉบับร่าง กำหนดเปิด ${fmtDay(d.startIso)} กดเปิดเมื่อตรวจรายชื่อเสร็จ` : "ฉบับร่าง ยังไม่ได้เปิด กดเปิดเมื่อตรวจรายชื่อเสร็จ",
      pill: <StatusPill tone="info" icon={Pencil}>ฉบับร่าง</StatusPill>,
      href: d.href,
      action: "ตรวจและเปิดรอบ",
      icon: GvDraftIcon,
      status: "info",
    });
  }
  const more = Math.max(0, o.draftCount - o.drafts.length);
  return (
    <article className={CARD} aria-label="งานประเมินที่รอ HR">
      <h3 className="text-base leading-snug font-semibold">
        รอคุณทำ {rows.length > 0 && <span className="font-medium text-muted-foreground tabular-nums">({rows.length} เรื่อง)</span>}
      </h3>
      {rows.length === 0 ? (
        <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          ตอนนี้ไม่มีงานประเมินรอคุณ รอบที่ปิดแล้วหรือฉบับร่างใหม่จะขึ้นที่นี่
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2.5">
              <span className="flex min-w-0 flex-[1_1_14rem] items-center gap-3">
                <GvIconTile icon={r.icon} status={r.status} />
                <span className="min-w-0">
                  <span className="block text-sm leading-snug font-semibold break-words">{r.title}</span>
                  <span className="block text-xs leading-snug text-muted-foreground">{r.sub}</span>
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {r.pill}
                <Link href={r.href} className={BTN}>
                  {r.action}
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}
      {more > 0 && <p className="mt-1 text-xs text-muted-foreground">และฉบับร่างอีก {more} รอบ ดูที่หน้าประเมินผล</p>}
    </article>
  );
}

/** An open round in short: progress, the department with the most still waiting, and the three people waiting longest. */
export function HrOpenRound({ round, faces }: { round: OpenRound; faces: EvaluationOverview["faces"] }) {
  const s = round.summary;
  const worst = [...s.byDepartment].filter((d) => d.pending > 0).sort((a, b) => b.pending - a.pending)[0];
  const top = s.pendingPeople.slice(0, 3);
  return (
    <article className={CARD} aria-label={round.name}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <GvIconTile icon={GvEvaluationIcon} />
        <h3 className="text-base leading-snug font-semibold break-words">{round.name}</h3>
        <DaysLeft round={round} />
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <dd className="text-[1.75rem] leading-snug font-bold tabular-nums">{s.forms.percentSubmitted}%</dd>
          <dt className="text-sm text-muted-foreground tabular-nums">
            ส่งแล้ว {s.forms.submitted} จาก {s.forms.total} ใบ
          </dt>
        </div>
        <div>
          <dd className="text-[1.75rem] leading-snug font-bold tabular-nums">{s.people.pending}</dd>
          <dt className="text-sm text-muted-foreground">คนที่ยังรอประเมิน จาก {s.people.total} คน</dt>
        </div>
      </dl>
      {s.forms.total > 0 && (
        <>
          <div className="mt-2 flex h-3.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`ส่งแล้ว ${s.forms.submitted} กำลังทำ ${s.forms.inProgress} ยังไม่เริ่ม ${s.forms.notStarted} จากทั้งหมด ${s.forms.total} ใบ`}>
            <span className="h-full bg-primary" style={{ width: `${(s.forms.submitted / s.forms.total) * 100}%` }} />
            <span className="h-full bg-primary/45" style={{ width: `${(s.forms.inProgress / s.forms.total) * 100}%` }} />
          </div>
          <p className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-muted-foreground tabular-nums">
            <span>ส่งแล้ว {s.forms.submitted}</span>
            <span>กำลังทำ {s.forms.inProgress}</span>
            <span>ยังไม่เริ่ม {s.forms.notStarted}</span>
          </p>
        </>
      )}
      {worst && s.byDepartment.length > 1 && (
        <p className="mt-3 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
          แผนกที่ค้างมากสุด: <b>{worst.department}</b> ค้าง {worst.pending} จาก {worst.total} คน ระบบเตือนผู้ประเมินให้ทุกวัน
        </p>
      )}
      {top.length > 0 && (
        <section aria-label="คนที่ค้างนานสุด" className="mt-3">
          <h4 className="text-sm font-semibold">ค้างนานสุด {top.length} คน</h4>
          <ul className="divide-y divide-border">
            {top.map((p) => (
              <li key={p.employeeId} className="flex items-center gap-3 py-2">
                <PersonAvatar name={p.name} gender={faces[p.employeeId]?.gender ?? null} seed={p.employeeId} src={faces[p.employeeId]?.photo ?? null} className="size-8 border border-border text-[11px] font-bold" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-snug font-semibold break-words">{p.name}</span>
                  <span className="block text-xs leading-snug text-muted-foreground">{p.department}</span>
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  <span className="block">รอ: {p.waiting}</span>
                  <span className="block tabular-nums">
                    ส่งแล้ว {p.submitted}/{p.total}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="mt-4">
        <Link href={round.href} className={BTN}>
          ดูคนที่ยังไม่ประเมินทั้งหมด
        </Link>
      </div>
    </article>
  );
}

/** The latest approved round on one line; the grade spread, department averages and ranking live on the round page. */
export function HrResultsLine({ r }: { r: ResultsCard }) {
  const change = r.change
    ? r.change.direction === "up"
      ? `เพิ่มขึ้น ${r.change.delta} จุด`
      : r.change.direction === "down"
        ? `ลดลง ${Math.abs(r.change.delta)} จุด`
        : "เท่ารอบก่อน"
    : null;
  return (
    <article className={cn(CARD, "flex flex-wrap items-center justify-between gap-3")} aria-label={`ผลประเมิน ${r.roundName}`}>
      <p className="min-w-0 flex-[1_1_16rem] text-sm leading-snug">
        <span className="font-semibold break-words">รอบก่อน: {r.roundName}</span> ผลครบ {r.count} คน{r.missing > 0 ? ` (อีก ${r.missing} คนยังไม่มีผล)` : ""} ค่าเฉลี่ย <span className="tabular-nums">{r.average}%</span>
        {change ? ` ${change}` : ""}
      </p>
      <span className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-muted px-2.5 py-0.5 text-xs font-semibold text-success">
          <CheckCircle2 className="size-3.5" aria-hidden="true" /> อนุมัติผลแล้ว
        </span>
        <Link href={r.href} className={BTN}>
          ดูผลและรายงาน
        </Link>
      </span>
    </article>
  );
}

function MyTasks({ o }: { o: EvaluationOverview }) {
  if (o.myTasks.length === 0) return null;
  const waiting = o.myTasks.filter((t) => t.status !== "SUBMITTED");
  return (
    <article className={CARD} aria-label="ประเมินลูกทีม">
      <h3 className="text-base leading-snug font-semibold">
        ลูกทีมที่รอคุณประเมิน <span className="tabular-nums">({waiting.length} จาก {o.myTasks.length} คน)</span>
      </h3>
      <ul className="mt-2 divide-y divide-border">
        {o.myTasks.slice(0, 8).map((t) => (
          <li key={t.assignmentId} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-sm font-semibold break-words">{t.person}</span>
            {t.status === "SUBMITTED" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-muted px-2.5 py-0.5 text-xs font-semibold text-success">
                <CheckCircle2 className="size-3.5" aria-hidden="true" /> ประเมินแล้ว
              </span>
            ) : (
              <Link href="/appraisal/tasks" className={BTN}>
                <PenLine className="mr-1.5 size-4" aria-hidden="true" />
                {t.status === "IN_PROGRESS" ? "ทำต่อ" : "ประเมิน"}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}

/** The home page's evaluation section: rounds in progress, who is still waiting, and approved results. */
export async function EvaluationOverviewSection({ companyId, session }: { companyId: string; session: AccessClaims }) {
  let o: EvaluationOverview;
  try {
    o = await loadEvaluationOverview(companyId, session);
  } catch {
    return (
      <section aria-label="การประเมินผล" className="space-y-3">
        <SectionHeading title="การประเมินผล" />
        <p role="alert" className={cn(CARD, "text-sm text-muted-foreground")}>
          โหลดข้อมูลการประเมินไม่ได้ในตอนนี้ ลองรีเฟรชหน้า ถ้ายังไม่ได้ แจ้ง HR
        </p>
      </section>
    );
  }

  const nothing = o.open.length === 0 && !o.results && !o.awaitingCalculation;
  // HR sees the work first and the numbers short; managers keep the team view below.
  const hrView = o.companyWide && (can(session.perms, "campaign:update") || can(session.perms, "campaign:approve"));
  const hint = o.companyWide ? "รอบที่เปิดอยู่ เรียงจากใกล้ปิดที่สุด" : "เฉพาะลูกทีมของคุณ";

  if (hrView) {
    return (
      <section id="evaluation" aria-label="การประเมินผล" className="scroll-mt-24 space-y-3">
        <SectionHeading title="การประเมินผล" hint="เห็นเฉพาะ HR" />
        <div className="space-y-3 rounded-lg border border-border bg-card p-3 shadow-[var(--card-shadow)] sm:p-5">
          <HrEvalTiles o={o} />
          {o.awaitingReview.length + (o.awaitingCalculation ? 1 : 0) + o.drafts.length > 0 && <HrWorkCard o={o} />}
          {o.open.map((r) => (
            <HrOpenRound key={r.id} round={r} faces={o.faces} />
          ))}
          <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
            <ResultsBoardCard board={o.resultsBoard} />
            <div className={o.resultsBoard.length === 0 ? "lg:col-span-2" : undefined}>
              <TemplateCard templates={o.templates} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="evaluation" aria-label="การประเมินผล" className="scroll-mt-24 space-y-3">
      <SectionHeading title="การประเมินผล" hint={hint} />
      {nothing ? (
        <div className={cn(CARD, "text-center")}>
          <p className="font-semibold">ยังไม่มีรอบประเมินที่เปิดอยู่</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {o.draftCount > 0
              ? `มีรอบฉบับร่าง ${o.draftCount} รอบ ยังไม่เปิด กดไปที่หน้าประเมินผลเพื่อเลือกผู้ถูกประเมินและผู้ประเมิน`
              : o.companyWide
                ? "เมื่อเปิดรอบประเมิน ความคืบหน้าและคนที่ยังรอประเมินจะขึ้นที่นี่"
                : "เมื่อ HR เปิดรอบประเมิน ลูกทีมที่รอคุณประเมินจะขึ้นที่นี่"}
          </p>
          {o.companyWide && (
            <Link href="/appraisal" className={cn(BTN_PRIMARY, "mt-3")}>
              ไปที่หน้าประเมินผล
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {o.open.map((r) => (
            <OpenRoundCard key={r.id} round={r} companyWide={o.companyWide} />
          ))}
          <MyTasks o={o} />
          {o.awaitingCalculation && (
            <article className={cn(CARD, "flex flex-wrap items-center justify-between gap-3")}>
              <p className="text-sm">
                <span className="font-semibold">{o.awaitingCalculation.name}</span> ปิดแล้ว ยังไม่คำนวณผล
              </p>
              <Link href={o.awaitingCalculation.href} className={BTN}>
                ไปคำนวณผล
              </Link>
            </article>
          )}
          {o.results && <ResultsView r={o.results} />}
        </div>
      )}
    </section>
  );
}
