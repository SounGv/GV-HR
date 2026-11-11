"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, Check, ClipboardList, FileText, Plus } from "lucide-react";
import { toast } from "sonner";

import { CountUp } from "@/components/shared/count-up";
import { SectionHeading } from "@/components/shared/section-heading";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppraisalForms } from "@/features/appraisal-form/hooks";
import type { FormListItem, FormStatus } from "@/features/appraisal-form/types";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useCreateRound, useDepartmentProgress, usePublishedForms, useRoundProgress, useRounds } from "./hooks";
import { ROUND_STATUS_LABEL, type RoundListItem, type RoundStatus } from "./types";

/* ── helpers ─────────────────────────────────────────────────────────── */

const LIME = "#CDEB03";
const CHARCOAL = "#131516";
const MAX_ROWS = 8;

const fmtDate = (iso: string, withYear = false) =>
  new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: withYear ? "numeric" : undefined, timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );

/** "1 ธ.ค. – 25 ธ.ค." / "เริ่ม 5 ม.ค." / "ปิด 25 ธ.ค." / "ยังไม่กำหนดวัน". */
function dateRange(start: string | null, end: string | null) {
  if (start && end) return `${fmtDate(start)} – ${fmtDate(end)}`;
  if (start) return `เริ่ม ${fmtDate(start)}`;
  if (end) return `ปิด ${fmtDate(end)}`;
  return "ยังไม่กำหนดวัน";
}

/** Whole days from today (Bangkok) to a YYYY-MM-DD date; negative once it has passed. */
function daysUntil(iso: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** Open rounds, the one closing soonest first (rounds without a close date last). */
function openRoundsBySoonest(rounds: RoundListItem[]) {
  return rounds
    .filter((r) => r.status === "OPEN")
    .sort((a, b) => (a.endIso ?? "9999-12-31").localeCompare(b.endIso ?? "9999-12-31"));
}

const ROUND_TONE: Record<RoundStatus, StatusTone> = { OPEN: "success", SCHEDULED: "warning", DRAFT: "warning", CLOSED: "neutral" };
const ROUND_EDGE: Record<RoundStatus, string> = {
  OPEN: "var(--success)",
  SCHEDULED: "var(--warning)",
  DRAFT: "var(--warning)",
  CLOSED: "#9ca3af",
};

const FORM_LABEL: Record<FormStatus, string> = { DRAFT: "ฉบับร่าง", PUBLISHED: "ใช้งานอยู่", ARCHIVED: "เก็บแล้ว" };
const FORM_TONE: Record<FormStatus, StatusTone> = { DRAFT: "warning", PUBLISHED: "success", ARCHIVED: "neutral" };
const FORM_EDGE: Record<FormStatus, string> = { DRAFT: "var(--warning)", PUBLISHED: "var(--success)", ARCHIVED: "#9ca3af" };

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

/** Creates an empty draft round and opens it in the 5-step wizard (same flow as the rounds page). */
function useStartNewRound() {
  const router = useRouter();
  const create = useCreateRound();
  async function start() {
    try {
      if (!window.confirm("สร้างรอบประเมินฉบับร่างใหม่? (ยังไม่ส่งถึงใคร จนกว่าจะเปิดรอบ)")) return;
      const res = await create.mutateAsync("รอบประเมินใหม่");
      router.push(`/appraisal/rounds/${res.data.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "สร้างรอบไม่สำเร็จ");
    }
  }
  return { start, pending: create.isPending };
}

/* ── header actions ─────────────────────────────────────────────────── */

/** "สร้างรอบประเมิน" for the overview header (needs campaign:create); แบบประเมิน is a tab above the page now. */
export function OverviewActions({ className }: { className?: string }) {
  const { can } = useAuth();
  const newRound = useStartNewRound();
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {can("campaign:create") && (
        <Button className="h-11 md:h-9" onClick={newRound.start} disabled={newRound.pending}>
          <Plus className="size-4" /> สร้างรอบประเมิน
        </Button>
      )}
    </div>
  );
}

/* ── hero ────────────────────────────────────────────────────────────── */

/** White pill used for the one next action inside the hero. */
function HeroPill({ href, onClick, disabled, children }: { href?: string; onClick?: () => void; disabled?: boolean; children: ReactNode }) {
  const cls =
    "inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-bold text-[#0f766e] transition-colors hover:bg-white/90 disabled:opacity-60 md:h-9";
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

function Eyebrow({ tone, children }: { tone: "waiting" | "open"; children: ReactNode }) {
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-bold"
      style={tone === "open" ? { background: LIME, color: CHARCOAL } : { background: "#fde047", color: "#3f2d00" }}
    >
      {children}
    </span>
  );
}

type StepState = "done" | "now" | "later";

const NOW_TILE: CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.09))",
  borderColor: "rgba(205,235,3,0.6)",
  boxShadow: "0 0 0 1px rgba(205,235,3,0.35), inset 0 1px 0 rgba(255,255,255,0.16)",
};

function StepTile({ n, state, title, note, action }: { n: number; state: StepState; title: string; note: string; action?: ReactNode }) {
  return (
    <li className={cn("gv-glass grid content-start gap-1.5 px-4 py-3.5", state === "later" && "opacity-70")} style={state === "now" ? NOW_TILE : undefined}>
      <div className="flex items-center gap-2.5 text-[14.5px] leading-snug font-bold">
        <span
          className={cn(
            "grid size-7 flex-none place-items-center rounded-full border text-[13px] font-bold",
            state === "later" && "border-white/25 bg-white/15",
            state === "now" && "border-white bg-white text-[#0f766e]",
          )}
          style={state === "done" ? { background: LIME, borderColor: LIME, color: CHARCOAL } : undefined}
          aria-hidden
        >
          {state === "done" ? <Check className="size-4" strokeWidth={3} /> : n}
        </span>
        <span>
          {title}
          <span className="sr-only">{state === "done" ? " (เสร็จแล้ว)" : state === "now" ? " (ขั้นปัจจุบัน)" : " (ขั้นถัดไป)"}</span>
        </span>
      </div>
      <p className="text-[12.5px] leading-relaxed break-words text-white/80">{note}</p>
      {action && <div className="mt-1">{action}</div>}
    </li>
  );
}

/** No round is open: the 3 steps to get one going, worked out from the forms and rounds that exist. */
function SetupHero({ rounds }: { rounds: RoundListItem[] }) {
  const { can } = useAuth();
  const newRound = useStartNewRound();
  const forms = useAppraisalForms();
  const published = usePublishedForms();

  if (forms.isError) return <ErrorState title="โหลดแบบประเมินไม่สำเร็จ" onRetry={() => forms.refetch()} />;
  if (forms.isLoading) return <Skeleton className="h-64 w-full rounded-[22px]" />;

  const list = forms.data?.data ?? [];
  const drafts = list.filter((f) => f.status === "DRAFT");
  // Published versions can sit behind a newer draft in the list, so ask the rounds API too.
  const publishedCount = Math.max(published.data?.data.length ?? 0, list.filter((f) => f.status === "PUBLISHED").length);
  const bestDraft = drafts.find((f) => f.questionCount > 0);
  const s1 = list.length > 0;
  const s2 = publishedCount > 0;
  const current = !s1 ? 1 : !s2 ? 2 : 3;
  const stateOf = (n: number): StepState => (n < current ? "done" : n === current ? "now" : "later");

  const pending = rounds.find((r) => r.status === "SCHEDULED") ?? rounds.find((r) => r.status === "DRAFT");

  const sub =
    current === 1
      ? "ตอนนี้อยู่ขั้นที่ 1 · ยังไม่มีแบบประเมิน"
      : current === 2
        ? `ตอนนี้อยู่ขั้นที่ 2 · มีแบบประเมินฉบับร่าง ${drafts.length} แบบ ยังไม่มีแบบที่ยืนยันใช้`
        : `ตอนนี้อยู่ขั้นที่ 3 · ยืนยันใช้แบบประเมินแล้ว ${publishedCount} แบบ พร้อมสร้างรอบ`;

  let step2Note = "กดยืนยันใช้ในหน้าแบบประเมิน แล้วจึงเลือกในรอบได้";
  let step2Action: ReactNode = null;
  if (s2) step2Note = `ยืนยันใช้แล้ว ${publishedCount} แบบ`;
  else if (current === 2 && bestDraft) {
    step2Note = `"${bestDraft.name}" พร้อมยืนยัน (${bestDraft.questionCount} คำถาม)`;
    step2Action = <HeroPill href={`/appraisal/forms/${bestDraft.id}`}>ไปยืนยันแบบนี้ →</HeroPill>;
  } else if (current === 2) {
    step2Note = "ทุกแบบยังไม่มีคำถาม ใส่คำถามก่อน แล้วกดยืนยันใช้";
    step2Action = <HeroPill href={drafts[0] ? `/appraisal/forms/${drafts[0].id}` : "/appraisal/forms"}>ไปเพิ่มคำถาม →</HeroPill>;
  }

  let step3Note = "เลือกแบบ คนที่ถูกประเมิน และวันเปิด–ปิด";
  let step3Action: ReactNode = null;
  if (current === 3) {
    if (pending?.status === "SCHEDULED") {
      step3Note = `"${pending.name}" ตั้งเวลาไว้แล้ว${pending.startIso ? ` · เปิด ${fmtDate(pending.startIso, true)}` : ""}`;
      step3Action = <HeroPill href={`/appraisal/rounds/${pending.id}`}>ดูรอบ →</HeroPill>;
    } else if (pending) {
      step3Note = `มีรอบฉบับร่าง "${pending.name}" ทำต่อได้เลย`;
      step3Action = <HeroPill href={`/appraisal/rounds/${pending.id}`}>ทำต่อ →</HeroPill>;
    } else if (can("campaign:create")) {
      step3Action = (
        <HeroPill onClick={newRound.start} disabled={newRound.pending}>
          สร้างรอบประเมิน →
        </HeroPill>
      );
    }
  }

  return (
    <section className="gv-hero gv-rise p-5 sm:p-6" style={rise(0)} aria-labelledby="appraisal-hero-title">
      <Eyebrow tone="waiting">ยังไม่มีรอบที่เปิดอยู่</Eyebrow>
      <h2 id="appraisal-hero-title" className="mt-2.5 text-[22px] leading-snug font-bold sm:text-[26px]">
        เริ่มประเมินได้ใน 3 ขั้น
      </h2>
      <p className="mt-0.5 text-[13.5px] leading-relaxed text-white/80">{sub}</p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        <StepTile
          n={1}
          state={stateOf(1)}
          title="สร้างแบบประเมิน"
          note={s1 ? `มีแล้ว ${list.length} แบบ${drafts.length === list.length ? " (ฉบับร่าง)" : ""}` : "ตั้งคำถามและเกณฑ์คะแนนที่จะใช้ประเมิน"}
          action={!s1 ? <HeroPill href="/appraisal/forms">ไปสร้างแบบประเมิน →</HeroPill> : undefined}
        />
        <StepTile n={2} state={stateOf(2)} title="ยืนยันใช้แบบประเมิน" note={step2Note} action={step2Action} />
        <StepTile n={3} state={stateOf(3)} title="สร้างและเปิดรอบ" note={step3Note} action={step3Action} />
      </ol>
    </section>
  );
}

function Kpi({ label, value, unit, children }: { label: string; value: ReactNode; unit?: string; children?: ReactNode }) {
  return (
    <div className="gv-glass min-w-0 px-4 py-3.5">
      <p className="text-[13px] leading-snug font-semibold text-white/90">{label}</p>
      <p className="mt-1 text-[26px] leading-tight font-bold tabular-nums sm:text-[28px]">
        {value}
        {unit && <span className="ml-1 text-xs font-medium text-white/75">{unit}</span>}
      </p>
      {children}
    </div>
  );
}

/** At least one round is open: the one closing soonest, with its live numbers. */
function OpenRoundHero({ round, others }: { round: RoundListItem; others: number }) {
  const progress = useRoundProgress(round.id, true);
  const p = progress.data?.data;
  const submitted = p?.submitted ?? round.submitted;
  const total = p?.total ?? round.total;
  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
  const left = round.endIso ? daysUntil(round.endIso) : null;
  const dash = <span className="text-white/60">–</span>;

  return (
    <section className="gv-hero gv-rise p-5 sm:p-6" style={rise(0)} aria-labelledby="appraisal-hero-title">
      <Eyebrow tone="open">เปิดอยู่{round.endIso ? ` · ปิด ${fmtDate(round.endIso, true)}` : ""}</Eyebrow>
      <h2 id="appraisal-hero-title" className="mt-2.5 text-[22px] leading-snug font-bold break-words sm:text-[26px]">
        {round.name}
      </h2>
      <p className="mt-0.5 text-[13.5px] leading-relaxed break-words text-white/80">
        {round.formName && <>ใช้ &ldquo;{round.formName}&rdquo; · </>}
        {round.participantCount} คนที่ถูกประเมิน
        {others > 0 && ` · เปิดอยู่อีก ${others} รอบ (ดูด้านล่าง)`}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="ส่งแล้ว" value={<CountUp value={submitted} />} unit={`/ ${total} งาน`}>
          <div
            role="progressbar"
            aria-label={`ส่งแล้ว ${pct}%`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"
          >
            <div className="gv-grow h-full rounded-full" style={{ width: `${pct}%`, background: LIME }} />
          </div>
        </Kpi>
        <Kpi label="ยังไม่เริ่ม" value={p ? <CountUp value={p.pending} /> : dash} unit="งาน" />
        <Kpi label="ทำค้างไว้" value={p ? <CountUp value={p.inProgress} /> : dash} unit="งาน" />
        {left === null ? (
          <Kpi label="เหลือเวลา" value={dash} unit="ไม่ได้กำหนดวันปิด" />
        ) : left <= 0 ? (
          <Kpi label="เหลือเวลา" value={<span className="text-xl">{left === 0 ? "วันสุดท้าย" : "เลยกำหนดแล้ว"}</span>} />
        ) : (
          <Kpi label="เหลือเวลา" value={<CountUp value={left} />} unit="วัน" />
        )}
      </div>
    </section>
  );
}

/* ── list rows ───────────────────────────────────────────────────────── */

function ListRow({
  href,
  edge,
  icon: Icon,
  title,
  meta,
  chip,
  linkText,
}: {
  href: string;
  edge: string;
  icon: typeof FileText;
  title: string;
  meta: string;
  chip: ReactNode;
  linkText: string;
}) {
  return (
    <li className="border-t border-border/70 first:border-t-0">
      <Link
        href={href}
        className="gv-edge grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 pr-4 pl-5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:gap-3.5"
        style={{ "--edge": edge } as CSSProperties}
      >
        <span className="grid size-9 place-items-center rounded-[10px] border border-border bg-accent text-accent-foreground" aria-hidden>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-[14.5px] leading-snug font-semibold break-words text-foreground">{title}</span>
          <span className="block text-[12.5px] leading-relaxed text-muted-foreground tabular-nums">{meta}</span>
        </span>
        {chip}
        <span className="hidden text-[13px] font-semibold whitespace-nowrap text-primary sm:inline">{linkText}</span>
      </Link>
    </li>
  );
}

function AllLink({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex h-11 items-center text-[13px] font-semibold text-primary hover:underline md:h-auto">
      ดูทั้งหมด →
    </Link>
  );
}

/* ── sections ────────────────────────────────────────────────────────── */

function RoundsSection({ rounds, hasPublished }: { rounds: RoundListItem[]; hasPublished: boolean }) {
  const shown = rounds.slice(0, MAX_ROWS);
  return (
    <section className="space-y-3">
      <SectionHeading title="รอบประเมิน" hint="ทุกรอบ เรียงจากล่าสุด" action={rounds.length > 0 ? <AllLink href="/appraisal/rounds" /> : undefined} />
      {rounds.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="ยังไม่มีรอบประเมิน"
          description={hasPublished ? "กด “สร้างรอบประเมิน” ด้านบนเพื่อเริ่มรอบแรก" : "ยืนยันใช้แบบประเมินก่อน แล้วกด “สร้างรอบประเมิน”"}
          className="gv-rise py-10"
        />
      ) : (
        <Card className="gv-rise gap-0 py-0" style={rise(1)}>
          <ul aria-label="รอบประเมิน">
            {shown.map((r) => (
              <ListRow
                key={r.id}
                href={`/appraisal/rounds/${r.id}`}
                edge={ROUND_EDGE[r.status]}
                icon={CalendarClock}
                title={r.name}
                meta={`${r.participantCount} คน · ${dateRange(r.startIso, r.endIso)}`}
                chip={<StatusChip tone={ROUND_TONE[r.status]} label={ROUND_STATUS_LABEL[r.status]} />}
                linkText="ดูรอบ →"
              />
            ))}
          </ul>
          {rounds.length > MAX_ROWS && (
            <p className="border-t border-border/70 px-5 py-2.5 text-[12.5px] text-muted-foreground">
              แสดง {MAX_ROWS} จาก {rounds.length} รอบ
            </p>
          )}
        </Card>
      )}
    </section>
  );
}

function DepartmentSection({ round }: { round: RoundListItem }) {
  const dept = useDepartmentProgress(round.id, true);
  const rows = dept.data?.data ?? [];
  return (
    <section className="space-y-3">
      <SectionHeading title="ความคืบหน้ารายแผนก" hint={round.name} />
      {dept.isError ? (
        <ErrorState onRetry={() => dept.refetch()} />
      ) : dept.isLoading ? (
        <TableLoadingState rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState title="ยังไม่มีข้อมูลรายแผนก" className="py-10" />
      ) : (
        <Card className="gv-rise gap-0 py-0" style={rise(2)}>
          <ul aria-label={`ความคืบหน้ารายแผนก ${round.name}`}>
            {rows.map((d) => (
              <li key={d.department} className="border-t border-border/70 px-5 py-3 first:border-t-0">
                <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                  <span className="min-w-0 font-semibold break-words">{d.department}</span>
                  <span className="flex-none text-muted-foreground tabular-nums">
                    {d.submitted}/{d.total} ({d.percent}%)
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={d.department}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={d.percent}
                  className="mt-1.5 h-[7px] overflow-hidden rounded-full bg-muted"
                >
                  <div className="gv-grow h-full rounded-full bg-primary" style={{ width: `${d.percent}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

function formChip(f: FormListItem) {
  if (f.questionCount === 0) {
    return (
      <StatusChip
        tone="danger"
        dot={false}
        label={
          <>
            <AlertTriangle className="size-3" aria-hidden /> ไม่มีคำถาม
          </>
        }
      />
    );
  }
  return <StatusChip tone={FORM_TONE[f.status]} label={FORM_LABEL[f.status]} />;
}

function FormsSection() {
  const forms = useAppraisalForms();
  const list = forms.data?.data ?? [];
  return (
    <section className="space-y-3">
      <SectionHeading
        title="แบบประเมิน"
        hint="ต้องยืนยันใช้ก่อน จึงเลือกในรอบได้"
        action={list.length > MAX_ROWS ? <AllLink href="/appraisal/forms" /> : undefined}
      />
      {forms.isError ? (
        <ErrorState title="โหลดแบบประเมินไม่สำเร็จ" onRetry={() => forms.refetch()} />
      ) : forms.isLoading ? (
        <TableLoadingState rows={3} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="ยังไม่มีแบบประเมิน"
          description="สร้างแบบแรก ตั้งคำถาม แล้วกดยืนยันใช้"
          className="gv-rise py-10"
          action={
            <Button variant="outline" className="h-11 md:h-9" render={<Link href="/appraisal/forms" />}>
              ไปที่แบบประเมิน
            </Button>
          }
        />
      ) : (
        <Card className="gv-rise gap-0 py-0" style={rise(2)}>
          <ul aria-label="แบบประเมิน">
            {list.slice(0, MAX_ROWS).map((f) => (
              <ListRow
                key={f.id}
                href={`/appraisal/forms/${f.id}`}
                edge={f.questionCount === 0 ? "var(--destructive)" : FORM_EDGE[f.status]}
                icon={FileText}
                title={f.name}
                meta={`เวอร์ชัน ${f.version} · ${f.questionCount > 0 ? `${f.questionCount} คำถาม` : "ยังไม่มีคำถาม"}`}
                chip={formChip(f)}
                linkText={f.questionCount === 0 ? "แก้ไข →" : f.status === "DRAFT" ? "ยืนยันใช้ →" : "ดูแบบ →"}
              />
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

/* ── page body ───────────────────────────────────────────────────────── */

/**
 * Home of the evaluation menu (appraisal-overview-mock.html). With no open
 * round the hero walks HR through the 3 setup steps; with one open it shows
 * the round closing soonest and its live numbers. Below: every round (+ the
 * department progress of that open round) and every form. Each block loads
 * and fails on its own, so one bad request never blanks the page.
 */
export function OverviewView() {
  const rounds = useRounds();
  const forms = useAppraisalForms();
  const published = usePublishedForms();
  const list = rounds.data?.data ?? [];
  const open = openRoundsBySoonest(list);
  const lead = open[0];
  const hasPublished = (published.data?.data.length ?? 0) > 0 || (forms.data?.data ?? []).some((f) => f.status === "PUBLISHED");

  return (
    <div className="space-y-6">
      <OverviewActions className="md:hidden" />

      {rounds.isError ? (
        <ErrorState title="โหลดรอบประเมินไม่สำเร็จ" onRetry={() => rounds.refetch()} />
      ) : rounds.isLoading ? (
        <Skeleton className="h-64 w-full rounded-[22px]" />
      ) : lead ? (
        <OpenRoundHero round={lead} others={open.length - 1} />
      ) : (
        <SetupHero rounds={list} />
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          {rounds.isError ? (
            <section className="space-y-3">
              <SectionHeading title="รอบประเมิน" />
              <p className="text-sm text-muted-foreground">โหลดรายการรอบไม่ได้ กด “ลองใหม่” ด้านบน</p>
            </section>
          ) : rounds.isLoading ? (
            <section className="space-y-3">
              <SectionHeading title="รอบประเมิน" hint="ทุกรอบ เรียงจากล่าสุด" />
              <TableLoadingState rows={3} />
            </section>
          ) : (
            <RoundsSection rounds={list} hasPublished={hasPublished} />
          )}
          {lead && <DepartmentSection round={lead} />}
        </div>
        <div className="min-w-0">
          <FormsSection />
        </div>
      </div>
    </div>
  );
}
