"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, ChevronRight, Star } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { ChartBox, ColumnChart, PairedColumns, Segmented, SmoothLine, toneFill } from "./detail-report-svg";
import { Delta, fmt } from "./detail-report-tables";
import type { DetailOverview, DetailPerson } from "./detail-report-types";
import { bandOf, bestMovers, execHeadline, execTeams, teamNeedsLook, watchPeople, type BandTone, type ExecTeam } from "./exec-summary-rules";

/**
 * The first tab of the detailed report, for management (appraisal-boss-overview-mock.html): one sentence, four numbers, a score
 * per team, who to talk to first, and the company average by month. Everything is read from the same data as the other tabs;
 * no score is recalculated. Every number, row and column opens its detail in a side sheet.
 */

const TONE_TEXT: Record<BandTone, string> = { good: "ดี", ok: "ปกติ", watch: "ควรดู" };
const TONE_CHIP: Record<BandTone, string> = {
  good: "border-success/30 bg-success-muted text-success",
  ok: "border-warning/30 bg-warning/10 text-warning",
  watch: "border-destructive/30 bg-destructive-muted text-destructive",
};

function ToneChip({ tone, drop }: { tone: BandTone; drop?: boolean }) {
  const text = drop ? (tone === "watch" ? "ลดลงมาก" : `${TONE_TEXT[tone]} แต่ลดลงมาก`) : TONE_TEXT[tone];
  const mark = tone === "good" ? "✓" : tone === "watch" || drop ? "✗" : "";
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", TONE_CHIP[drop && tone !== "watch" ? "ok" : tone])}>{mark && <span aria-hidden="true">{mark}</span>}{text}</span>;
}

type Sheeted =
  | { kind: "low" }
  | { kind: "full" }
  | { kind: "small" }
  | { kind: "attn" }
  | { kind: "rounds" }
  | { kind: "team"; department: string }
  | { kind: "month"; index: number };

export function ExecTab({ data, onOpenPerson, onGoTab }: { data: DetailOverview; onOpenPerson: (participantId: string) => void; onGoTab: (tab: string) => void }) {
  const [view, setView] = useState<Sheeted | null>(null);
  const [teamMode, setTeamMode] = useState<"rows" | "cols">("rows");
  const [trendMode, setTrendMode] = useState<"cols" | "line">("cols");
  const h = data.history;
  const labels = h.rounds.map((r) => r.label);
  const head = useMemo(() => execHeadline(data.people, data.progress, h.company), [data.people, data.progress, h.company]);
  const { shown, small } = useMemo(() => execTeams(data.teams), [data.teams]);
  const attn = shown.filter(teamNeedsLook);
  const watch = useMemo(() => watchPeople(data.people), [data.people]);
  const best = useMemo(() => bestMovers(data.people), [data.people]);
  const low = data.people.filter((p) => p.total < 80).sort((a, b) => a.total - b.total);
  const full = data.people.filter((p) => p.total === 100);
  const smallPeople = data.people.filter((p) => small.some((t) => t.department === p.department));
  const roundWord = data.roundName || "รอบนี้";

  if (data.people.length === 0) return <Card className="p-4 text-sm text-muted-foreground">รอบนี้ยังไม่มีคนที่คำนวณผลแล้ว</Card>;

  const openTeam = (department: string) => setView({ kind: "team", department });

  return (
    <div className="space-y-4">
      <Card className="gap-3 border-l-4 border-l-primary p-4 md:p-5">
        <p className="text-xs font-bold tracking-wide text-primary">ภาพรวมรอบนี้</p>
        <p className="text-base leading-relaxed md:text-lg md:leading-loose">
          {roundWord}: คะแนนเฉลี่ยทั้งบริษัท <b className="tabular-nums">{fmt(head.avg)}%</b>
          {head.delta !== null && head.delta !== 0 && (
            <>
              {" "}
              <b className={head.delta < 0 ? "text-destructive" : "text-success"}>{head.delta < 0 ? "ลดลง" : "เพิ่มขึ้น"} {fmt(Math.abs(head.delta))}</b> จากรอบก่อน
            </>
          )}
          {head.asked > 0 && (
            <>
              {" "}
              ประเมินแล้ว <b className="tabular-nums">{head.submitted} จาก {head.asked} ใบ</b>
            </>
          )}{" "}
          มี{" "}
          <button type="button" className={cn("font-bold underline underline-offset-4", head.low > 0 ? "text-destructive" : "text-foreground")} onClick={() => setView({ kind: "low" })}>
            {head.low} คน
          </button>{" "}
          คะแนนต่ำกว่า 80 และมี{" "}
          <button type="button" className={cn("font-bold underline underline-offset-4", attn.length > 0 ? "text-destructive" : "text-foreground")} onClick={() => setView({ kind: "attn" })}>
            {attn.length} ทีม
          </button>{" "}
          ที่ควรดู
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={<BarChart3 className="size-5" />} label="คะแนนเฉลี่ยบริษัท" value={`${fmt(head.avg)}%`} sub={head.delta === null ? <span className="text-muted-foreground">ยังไม่มีรอบก่อนให้เทียบ</span> : <span><Delta value={head.delta} /> จากรอบก่อน</span>} hint="ดูแยกตามรอบ" onClick={() => setView({ kind: "rounds" })} />
          <Kpi icon={<CheckCircle2 className="size-5" />} label="ประเมินครบแล้ว" value={head.asked > 0 ? `${head.submittedPct}%` : "-"} sub={<span className="text-muted-foreground">{head.asked > 0 ? `${head.submitted} จาก ${head.asked} ใบ${head.asked > head.submitted ? ` (ค้าง ${head.asked - head.submitted} ใบ)` : ""}` : "ไม่มีข้อมูลจำนวนใบ"}</span>} hint={head.asked > head.submitted ? "ใครยังไม่ส่ง ดูที่หน้ารอบประเมิน" : undefined} />
          <Kpi icon={<AlertTriangle className="size-5" />} tone="bad" label="คนที่คะแนนต่ำกว่า 80" value={`${head.low} คน`} sub={head.lowBefore === null ? <span className="text-muted-foreground">ยังไม่มีรอบก่อนให้เทียบ</span> : <span className={head.low > head.lowBefore ? "text-destructive" : "text-muted-foreground"}>{head.low > head.lowBefore ? `▲ เพิ่มจากรอบก่อน ${head.low - head.lowBefore} คน` : head.low < head.lowBefore ? `▼ ลดจากรอบก่อน ${head.lowBefore - head.low} คน` : `รอบก่อน ${head.lowBefore} คน`}</span>} hint="ดูรายชื่อ" onClick={() => setView({ kind: "low" })} />
          <Kpi icon={<Star className="size-5" />} tone="good" label="ได้คะแนนเต็ม 100" value={`${head.full} คน`} sub={<span className="text-muted-foreground">{head.fullPct}% ของผู้ถูกประเมิน</span>} hint="ดูรายชื่อ" onClick={() => setView({ kind: "full" })} />
        </div>
        {head.full > 0 && head.fullPct >= 50 && <p className="text-sm text-warning">ครึ่งหนึ่งขึ้นไปของผู้ถูกประเมินได้เต็ม 100 อาจให้คะแนนง่ายเกินไป ลองดูรายคนก่อนสรุป</p>}
      </Card>

      <Card className="gap-3 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">แต่ละทีมเป็นอย่างไร <span className="ml-1 text-xs font-normal text-muted-foreground">เรียงจากควรดูก่อน · กดเพื่อดูรายคน</span></h3>
          <Segmented value={teamMode} onChange={setTeamMode} label="รูปแบบแสดงทีม" options={[{ value: "rows", label: "แถว" }, { value: "cols", label: "แท่งแนวตั้ง" }]} />
        </div>
        {teamMode === "rows" ? (
          <ul className="divide-y divide-border">
            {shown.map((t) => (
              <TeamRow key={t.department} t={t} companyAvg={head.avg} onClick={() => openTeam(t.department)} />
            ))}
            {small.length > 0 && (
              <li>
                <button type="button" onClick={() => setView({ kind: "small" })} className="flex min-h-11 w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-muted/50">
                  <span className="min-w-0 flex-1">
                    <b className="block leading-snug">ทีมเล็ก (แผนกที่มีไม่ถึง 3 คน)</b>
                    <span className="text-xs text-muted-foreground">{smallPeople.length} คน รวม {small.length} แผนก · ไม่แสดงคะแนนทีม</span>
                  </span>
                  <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">ดูรายคน</span>
                  <ChevronRight className="size-4 text-primary" aria-hidden="true" />
                </button>
              </li>
            )}
          </ul>
        ) : (
          <ChartBox min={560}>
            <TeamColumns teams={shown} companyAvg={head.avg} onPick={openTeam} />
          </ChartBox>
        )}
        <p className="text-xs text-muted-foreground">ดี = 90 ขึ้นไป · ปกติ = 80–89 · ควรดู = ต่ำกว่า 80 · “ลดลงมาก” = ลดตั้งแต่ 5 ขึ้นไป · เส้นดำ/เส้นประ = ค่าเฉลี่ยบริษัท · แผนกที่มีไม่ถึง 3 คนไม่แสดงคะแนนรวม</p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="gap-2 p-4 md:p-5">
          <h3 className="text-base font-semibold">ควรคุยก่อน <span className="ml-1 rounded-full border border-destructive/30 bg-destructive-muted px-2 text-xs text-destructive">{watch.length} คน</span></h3>
          <PeopleTable people={watch.slice(0, 5)} onOpen={onOpenPerson} showTeam />
          {watch.length > 5 && (
            <button type="button" className="min-h-11 text-left text-sm font-medium text-primary" onClick={() => setView({ kind: "low" })}>
              ดูทั้งหมด {watch.length} คน
            </button>
          )}
          {watch.length === 0 && <p className="text-sm text-muted-foreground">ไม่มีใครต่ำกว่า 80 หรือลดลงมากในรอบนี้</p>}
          <p className="text-xs text-muted-foreground">คะแนนต่ำกว่า 80 หรือลดลงตั้งแต่ 10 ขึ้นไป · เห็นเฉพาะ HR</p>
        </Card>
        <Card className="gap-2 p-4 md:p-5">
          <h3 className="text-base font-semibold">ดีขึ้นมากสุด <span className="ml-1 rounded-full border border-success/30 bg-success-muted px-2 text-xs text-success">{best.length} คน</span></h3>
          <PeopleTable people={best} onOpen={onOpenPerson} showTeam={false} />
          {best.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีใครที่คะแนนเพิ่มขึ้นจากรอบก่อน</p>}
        </Card>
      </div>

      <Card className="gap-3 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">ค่าเฉลี่ยบริษัทรายรอบ <span className="ml-1 text-xs font-normal text-muted-foreground">กดแท่งหรือจุดเพื่อดูรอบนั้น</span></h3>
          <Segmented value={trendMode} onChange={setTrendMode} label="รูปแบบกราฟรายรอบ" options={[{ value: "cols", label: "แท่งแนวตั้ง" }, { value: "line", label: "เส้นโค้ง" }]} />
        </div>
        <ChartBox min={520}>
          {trendMode === "cols" ? (
            <ColumnChart values={h.company} labels={labels} onPick={(i) => setView({ kind: "month", index: i })} label={`ค่าเฉลี่ยบริษัทรายรอบ: ${labels.map((l, i) => `${l} ${fmt(h.company[i])}`).join(", ")}`} />
          ) : (
            <SmoothLine values={h.company} labels={labels} onPick={(i) => setView({ kind: "month", index: i })} label={`ค่าเฉลี่ยบริษัทรายรอบ: ${labels.map((l, i) => `${l} ${fmt(h.company[i])}`).join(", ")}`} />
          )}
        </ChartBox>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" onClick={() => onGoTab("people")} className="min-h-11 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/5">ดูสรุปรายคนทั้งหมด</button>
          <button type="button" onClick={() => onGoTab("months")} className="min-h-11 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/5">ดูเทียบรายรอบ</button>
        </div>
      </Card>

      <ExecSheet view={view} onClose={() => setView(null)} data={data} onOpenPerson={(id) => { setView(null); onOpenPerson(id); }} onTeam={openTeam} lists={{ low, full, smallPeople, attn }} />
    </div>
  );
}

function Kpi({ icon, label, value, sub, hint, tone, onClick }: { icon: React.ReactNode; label: string; value: string; sub: React.ReactNode; hint?: string; tone?: "bad" | "good"; onClick?: () => void }) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-xs text-muted-foreground md:text-[13px]">
        <span className={cn("grid size-9 place-items-center rounded-[10px]", tone === "bad" ? "bg-destructive-muted text-destructive" : tone === "good" ? "bg-success-muted text-success" : "bg-primary/10 text-primary")} aria-hidden="true">{icon}</span>
        {label}
      </span>
      <strong className="mt-1 block text-[28px] leading-tight tabular-nums md:text-[34px]">{value}</strong>
      <span className="block text-[13px]">{sub}</span>
      {hint && <span className="mt-0.5 block text-xs text-primary">{hint}{onClick ? " ›" : ""}</span>}
    </>
  );
  const cls = cn("rounded-lg border border-border border-t-4 bg-card p-3 text-left", tone === "bad" ? "border-t-destructive" : tone === "good" ? "border-t-success" : "border-t-primary");
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, "min-h-11 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring")}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function TeamRow({ t, companyAvg, onClick }: { t: ExecTeam; companyAvg: number | null; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="grid min-h-11 w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-1 py-2.5 text-left hover:bg-muted/50 md:grid-cols-[11rem_1fr_4rem_7rem_9rem_1rem]">
        <span className="min-w-0">
          <b className="block leading-snug">{t.department}</b>
          <span className="text-xs text-muted-foreground">{t.count} คน</span>
        </span>
        <span className="relative order-last col-span-2 h-4 rounded-full bg-muted md:order-none md:col-span-1" aria-hidden="true">
          <span className="block h-full rounded-full" style={{ width: `${Math.min(100, t.avg)}%`, background: toneFill(t.avg) }} />
          {companyAvg !== null && <i className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-foreground" style={{ left: `${companyAvg}%` }} />}
        </span>
        <b className="text-right text-lg tabular-nums">{fmt(t.avg)}%</b>
        <span className="text-sm"><Delta value={t.delta} /></span>
        <span className="justify-self-end md:justify-self-start"><ToneChip tone={t.tone} drop={t.bigDrop} /></span>
        <ChevronRight className="hidden size-4 text-primary md:block" aria-hidden="true" />
      </button>
    </li>
  );
}

function TeamColumns({ teams, companyAvg, onPick }: { teams: ExecTeam[]; companyAvg: number | null; onPick: (department: string) => void }) {
  return (
    <div>
      <ColumnChart
        values={teams.map((t) => t.avg)}
        labels={teams.map((t) => t.department.replace(/^แผนก/, ""))}
        onPick={(i) => onPick(teams[i]!.department)}
        label={`คะแนนเฉลี่ยแต่ละทีมแบบแท่งแนวตั้ง: ${teams.map((t) => `${t.department} ${fmt(t.avg)}`).join(", ")}`}
        height={300}
        deltas={teams.map((t) => t.delta)}
        refValue={companyAvg}
      />
      <p className="text-center text-xs text-muted-foreground">แท่งเรียงจากควรดูก่อน · ▲▼ ใต้ชื่อทีมคือเปลี่ยนจากรอบก่อน · เส้นประ = ค่าเฉลี่ยบริษัท</p>
    </div>
  );
}

function PeopleTable({ people, onOpen, showTeam }: { people: DetailPerson[]; onOpen: (id: string) => void; showTeam: boolean }) {
  if (people.length === 0) return null;
  return (
    <ul className="divide-y divide-border">
      {people.map((p) => (
        <li key={p.participantId}>
          <button type="button" onClick={() => onOpen(p.participantId)} className="flex min-h-11 w-full items-center gap-3 px-1 py-2 text-left hover:bg-muted/50">
            <span className="min-w-0 flex-1">
              <span className="block leading-snug font-semibold text-primary">{p.name}</span>
              {showTeam && <span className="block text-xs text-muted-foreground">{p.department}</span>}
              {!showTeam && <span className="block text-xs text-muted-foreground">{p.department}</span>}
            </span>
            <b className="tabular-nums">{fmt(p.total)}%</b>
            <span className="w-24 text-right text-sm"><Delta value={p.delta} /></span>
          </button>
        </li>
      ))}
    </ul>
  );
}

interface Lists {
  low: DetailPerson[];
  full: DetailPerson[];
  smallPeople: DetailPerson[];
  attn: ExecTeam[];
}

function ExecSheet({ view, onClose, data, onOpenPerson, onTeam, lists }: { view: Sheeted | null; onClose: () => void; data: DetailOverview; onOpenPerson: (id: string) => void; onTeam: (department: string) => void; lists: Lists }) {
  const h = data.history;
  const labels = h.rounds.map((r) => r.label);
  const team = view?.kind === "team" ? data.teams.find((t) => t.department === view.department) : undefined;
  const teamPeople = view?.kind === "team" ? data.people.filter((p) => p.department === view.department).sort((a, b) => a.total - b.total) : [];
  const series = view?.kind === "team" ? (h.teams.find((t) => t.department === view.department)?.values ?? []) : [];

  let title = "";
  let body: React.ReactNode = null;
  if (view?.kind === "low") {
    title = `คนที่คะแนนต่ำกว่า 80 (${lists.low.length} คน)`;
    body = <PersonList people={lists.low} onOpen={onOpenPerson} />;
  } else if (view?.kind === "full") {
    title = `ได้คะแนนเต็ม 100 (${lists.full.length} คน)`;
    body = <PersonList people={lists.full} onOpen={onOpenPerson} />;
  } else if (view?.kind === "small") {
    title = "ทีมเล็ก (ไม่ถึง 3 คน)";
    body = (
      <>
        <p className="mb-2 text-sm text-muted-foreground">ไม่แสดงคะแนนรวมของทีม แต่กดดูรายคนได้</p>
        <PersonList people={lists.smallPeople} onOpen={onOpenPerson} />
      </>
    );
  } else if (view?.kind === "attn") {
    title = `ทีมที่ควรดู (${lists.attn.length} ทีม)`;
    body = (
      <ul className="divide-y divide-border">
        {lists.attn.map((t) => (
          <li key={t.department}>
            <button type="button" onClick={() => onTeam(t.department)} className="flex min-h-11 w-full items-center gap-3 py-2 text-left hover:bg-muted/50">
              <span className="min-w-0 flex-1 font-semibold text-primary">{t.department}</span>
              <b className="tabular-nums">{fmt(t.avg)}%</b>
              <span className="w-24 text-right text-sm"><Delta value={t.delta} /></span>
            </button>
          </li>
        ))}
        {lists.attn.length === 0 && <li className="py-3 text-sm text-muted-foreground">ไม่มีทีมที่ต่ำกว่า 80 หรือลดลงมากในรอบนี้</li>}
      </ul>
    );
  } else if (view?.kind === "rounds") {
    title = "คะแนนเฉลี่ยบริษัท แยกตามรอบ";
    body = (
      <>
        <ChartBox min={440}>
          <ColumnChart values={h.company} labels={labels} label="ค่าเฉลี่ยบริษัทรายรอบ" height={240} />
        </ChartBox>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 font-medium">รอบ</th>
              <th className="py-1 text-right font-medium">เฉลี่ย</th>
            </tr>
          </thead>
          <tbody>
            {h.rounds.map((r, i) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-2">{r.name}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{fmt(h.company[i])}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  } else if (view?.kind === "month") {
    const r = h.rounds[view.index];
    title = r?.name ?? "รอบ";
    body = (
      <>
        <p className="text-3xl font-bold tabular-nums">{fmt(h.company[view.index])}%</p>
        <ul className="mt-2 divide-y divide-border">
          {h.teams.map((t) => ({ department: t.department, value: t.values[view.index] ?? null, before: view.index > 0 ? (t.values[view.index - 1] ?? null) : null })).filter((t) => t.value !== null).sort((a, b) => (a.value as number) - (b.value as number)).map((t) => (
            <li key={t.department}>
              <button type="button" onClick={() => onTeam(t.department)} className="flex min-h-11 w-full items-center gap-3 py-2 text-left hover:bg-muted/50">
                <span className="min-w-0 flex-1 text-primary">{t.department}</span>
                <b className="tabular-nums">{fmt(t.value)}%</b>
                <span className="w-24 text-right text-sm"><Delta value={t.before !== null ? Math.round(((t.value as number) - t.before) * 10) / 10 : null} /></span>
              </button>
            </li>
          ))}
        </ul>
      </>
    );
  } else if (view?.kind === "team") {
    title = view.department;
    const prevAvg = team?.prevAvg ?? null;
    const t = team ? bandOf(team.avg) : "ok";
    body = (
      <>
        {team && (
          <>
            <p className="text-3xl font-bold tabular-nums">{team.count >= 3 ? `${fmt(team.avg)}%` : "ไม่แสดงคะแนนทีม"}</p>
            {team.count >= 3 && (
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <Delta value={team.delta} /> จากรอบก่อน{prevAvg !== null ? ` (${fmt(prevAvg)}%)` : ""} <ToneChip tone={t} />
              </p>
            )}
            <div className="my-3 grid grid-cols-3 gap-2 text-center">
              <Mini label="ผู้ถูกประเมิน" value={`${team.count} คน`} />
              <Mini label="ต่ำกว่า 80" value={`${team.scores.filter((s) => s < 80).length} คน`} />
              <Mini label="เต็ม 100" value={`${team.scores.filter((s) => s === 100).length} คน`} />
            </div>
          </>
        )}
        {team && team.count >= 3 && series.some((v) => v !== null) && (
          <>
            <h4 className="mb-1 text-sm font-semibold">คะแนนทีมรายรอบ</h4>
            <ChartBox min={440}>
              <ColumnChart values={series} labels={labels} label={`คะแนนทีมรายรอบ ${view.department}`} height={240} />
            </ChartBox>
          </>
        )}
        <h4 className="mt-3 mb-1 text-sm font-semibold">เทียบรายคน รอบก่อน → รอบนี้</h4>
        <ChartBox min={Math.max(440, teamPeople.length * 56 + 60)}>
          <PairedColumns
            rows={teamPeople.map((p) => ({ name: p.name.replace(/\s*\(.*\)$/, "").split(" ")[0] ?? p.name, a: p.prev, b: p.total, onPick: () => onOpenPerson(p.participantId) }))}
            label={`เทียบรายคนของ ${view.department}`}
          />
        </ChartBox>
        <p className="mb-2 text-xs text-muted-foreground">แท่งเทา = รอบก่อน · แท่งสี = รอบนี้ · แกนเริ่มที่ 50 · กดแท่งเพื่อดูรายละเอียดรายคน</p>
        <h4 className="mt-3 mb-1 text-sm font-semibold">รายคน</h4>
        <PersonList people={teamPeople} onOpen={onOpenPerson} />
      </>
    );
  }

  return (
    <Sheet open={view !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className="sr-only">รายละเอียดของรายการที่เลือก</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">{body}</div>
      </SheetContent>
    </Sheet>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-2 py-1.5">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <b className="tabular-nums">{value}</b>
    </div>
  );
}

function PersonList({ people, onOpen }: { people: DetailPerson[]; onOpen: (id: string) => void }) {
  if (people.length === 0) return <p className="text-sm text-muted-foreground">ไม่มีรายการ</p>;
  return (
    <ul className="divide-y divide-border">
      {people.map((p) => (
        <li key={p.participantId}>
          <button type="button" onClick={() => onOpen(p.participantId)} className="flex min-h-11 w-full items-center gap-3 py-2 text-left hover:bg-muted/50">
            <span className="min-w-0 flex-1">
              <span className="block leading-snug font-semibold text-primary">{p.name}</span>
              <span className="block text-xs text-muted-foreground">{p.department}</span>
            </span>
            <b className="tabular-nums">{fmt(p.total)}%</b>
            <span className="w-24 text-right text-sm"><Delta value={p.delta} /></span>
          </button>
        </li>
      ))}
    </ul>
  );
}
