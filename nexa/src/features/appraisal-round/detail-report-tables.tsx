"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Download, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DROP_LOOK_POINTS } from "@/features/report/result-insights";
import { cn } from "@/lib/utils";
import { DistributionChart, MoveBars, TeamBars, TrendLines, type TrendSeries } from "./detail-report-charts";
import { SCORE_TONES, toneOf, type ScoreTone } from "./detail-report-rules";
import type { DetailOverview, DetailPerson } from "./detail-report-types";

export const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "-" : Number.isInteger(n) ? String(n) : n.toFixed(1));
const r1 = (n: number) => Math.round(n * 10) / 10;
const mean = (v: number[]) => (v.length ? r1(v.reduce((s, x) => s + x, 0) / v.length) : null);

/** Up or down arrow with the size of the change; the word "เท่าเดิม" when nothing moved, "-" when there is nothing to compare. */
export function Delta({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return <span className={cn("text-muted-foreground", className)}>-</span>;
  if (value === 0)
    return (
      <span className={cn("inline-flex items-center gap-1 text-muted-foreground", className)}>
        <Minus className="size-3.5" aria-hidden="true" />
        เท่าเดิม
      </span>
    );
  const up = value > 0;
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", up ? "text-success" : "text-destructive", className)}>
      {up ? <ArrowUp className="size-3.5" aria-hidden="true" /> : <ArrowDown className="size-3.5" aria-hidden="true" />}
      {up ? "ขึ้น" : "ลง"} {fmt(Math.abs(value))}
    </span>
  );
}

/** The score colour of the HR sheets: the number always stays in the cell, the colour only says which group it is in (see the legend). */
const TONE_CLASS: Record<ScoreTone, string> = {
  full: "bg-status-normal-bg text-status-normal-fg",
  high: "bg-status-normal-bg/40 text-status-normal-fg",
  mid: "bg-status-late-bg text-status-late-fg",
  low: "bg-status-absent-bg text-status-absent-fg",
};

function ScoreCell({ value, suffix = "%", only }: { value: number | null; suffix?: string; only?: ScoreTone[] }) {
  if (value === null) return <TableCell className="text-center tabular-nums">-</TableCell>;
  const tone = toneOf(value);
  return <TableCell className={cn("text-center font-medium tabular-nums", (!only || only.includes(tone)) && TONE_CLASS[tone])}>{`${fmt(value)}${suffix}`}</TableCell>;
}

export function ToneLegend({ values }: { values?: number[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs print:hidden" aria-label="สีของช่องคะแนน">
      <span className="text-muted-foreground">ช่วงคะแนน</span>
      {SCORE_TONES.map((t) => (
        <span key={t.tone} className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-0.5">
          <i className={cn("inline-block size-3 rounded-[2px] border border-black/15", TONE_CLASS[t.tone].split(" ")[0])} aria-hidden="true" />
          {t.label}
          {values ? ` · ${values.filter((v) => toneOf(v) === t.tone).length} คน` : ""}
        </span>
      ))}
    </div>
  );
}

/** A CSV file Excel opens (UTF-8 with a BOM so Thai reads right). */
function downloadCsv(fileName: string, head: string[], rows: (string | number)[][]) {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const body = [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

const NameButton = ({ p, onOpen }: { p: DetailPerson; onOpen: (id: string) => void }) => (
  <button type="button" onClick={() => onOpen(p.participantId)} className="inline-flex min-h-11 items-center text-left font-medium whitespace-nowrap text-primary hover:underline md:min-h-0">
    {p.name}
  </button>
);

const RankHead = () => <TableHead className="w-12 text-center">No.</TableHead>;

/* ─────────────────────────────── ภาพรวม (ผู้บริหาร) ─────────────────────────────── */

function Kpi({ label, value, note }: { label: string; value: string; note?: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-border bg-card px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-3xl leading-snug font-bold tabular-nums">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="gap-2 rounded-sm p-4 print:break-inside-avoid">
      <div>
        <h3 className="text-base font-medium">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

export function OverviewTab({ data }: { data: DetailOverview }) {
  const people = data.people;
  const n = people.length;
  const avg = data.companyAvg ?? 0;
  const h = data.history;
  const prevAvg = h.rounds.length >= 2 ? h.company[h.company.length - 2] ?? null : null;
  const change = prevAvg === null ? null : r1(avg - prevAvg);
  const full = people.filter((p) => p.total >= 100).length;
  const low = people.filter((p) => p.total < 80).length;
  const bands = data.bins.map((b) => ({ label: b.label, count: people.filter((p) => p.total >= b.from && p.total <= b.to).length }));
  const teams = data.teams.map((t) => ({ name: t.department, count: t.count, avg: t.avg }));
  const movers = people.filter((p) => p.delta !== null && p.delta !== 0);
  const ups = movers.filter((p) => (p.delta as number) > 0).sort((a, b) => (b.delta as number) - (a.delta as number)).slice(0, 4);
  const downs = movers.filter((p) => (p.delta as number) < 0).sort((a, b) => (a.delta as number) - (b.delta as number)).slice(0, 4);
  const falls = movers.filter((p) => (p.delta as number) <= -DROP_LOOK_POINTS).sort((a, b) => (a.delta as number) - (b.delta as number));
  const best = data.teams[0];
  const worst = data.teams[data.teams.length - 1];

  const pick = data.teams.length >= 3 ? [data.teams[0]!, data.teams[1]!, data.teams[data.teams.length - 1]!] : data.teams;
  const palette: Pick<TrendSeries, "color" | "dash">[] = [{ color: "#1976d2" }, { color: "#90caf9" }, { color: "#455a64", dash: "6 4" }];
  const series: TrendSeries[] = [
    { name: "ทั้งบริษัท", values: h.company, color: "#0d47a1", width: 3.5 },
    ...pick.map((t, i) => ({ name: t.department, values: h.teams.find((x) => x.department === t.department)?.values ?? [], width: 2.5, ...palette[i]! })),
  ];
  const labels = h.rounds.map((r) => r.label);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="ผู้ถูกประเมิน" value={`${n} คน`} note={`${data.teams.length} ทีม`} />
        <Kpi label="ค่าเฉลี่ยบริษัท" value={`${fmt(avg)}%`} note={change === null ? "ยังไม่มีรอบก่อนให้เทียบ" : <><Delta value={change} /> จากรอบก่อน</>} />
        <Kpi label="ได้เต็ม 100%" value={`${full} คน`} note={n ? `${Math.round((full / n) * 100)}% ของทั้งหมด` : undefined} />
        <Kpi label="คะแนนต่ำกว่า 80" value={`${low} คน`} note="ควรคุยหรือดูแลเพิ่ม" />
      </div>

      <div className="rounded-sm border border-border border-l-4 border-l-primary bg-card px-4 py-3 text-sm">
        <p className="font-medium">สรุปสั้น</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>{change === null ? `ค่าเฉลี่ยบริษัท ${fmt(avg)}% ยังไม่มีรอบก่อนให้เทียบ` : `ค่าเฉลี่ยบริษัท ${fmt(avg)}% ${change > 0 ? `ขึ้น ${fmt(change)}` : change < 0 ? `ลง ${fmt(-change)}` : "เท่าเดิม"}${change === 0 ? "" : " จุด"}จากรอบก่อน`}</li>
          {best && worst && data.teams.length >= 2 && (
            <li>
              ทีมคะแนนสูงสุดคือ {best.department} ({fmt(best.avg)}%) ต่ำสุดคือ {worst.department} ({fmt(worst.avg)}%) ห่างกัน {fmt(r1(best.avg - worst.avg))} จุด
            </li>
          )}
          <li>
            {falls.length
              ? `คะแนนลดลงตั้งแต่ ${DROP_LOOK_POINTS} จุด ${falls.length} คน: ${falls.slice(0, 5).map((p) => `${p.name} (ลง ${fmt(-(p.delta as number))})`).join(", ")}${falls.length > 5 ? " และอีกหลายคน" : ""}`
              : "ไม่มีใครคะแนนลดลงถึงเกณฑ์ที่ควรดู"}
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <ChartCard title="การกระจายคะแนน" hint="จำนวนคนในแต่ละช่วงคะแนน">
          <DistributionChart bands={bands} />
        </ChartCard>
        <ChartCard title="ค่าเฉลี่ยรายทีม เทียบทั้งบริษัท" hint="เส้นประคือค่าเฉลี่ยบริษัท">
          <TeamBars teams={teams} company={avg} />
        </ChartCard>
      </div>

      <ChartCard title="แนวโน้มคะแนนเฉลี่ยรายรอบ" hint="เทียบกันได้แม้สเกลแบบประเมินเปลี่ยน เพราะใช้เปอร์เซ็นต์ของคะแนนเต็ม แสดงบริษัท ทีมสูงสุด ทีมรองลงมา และทีมต่ำสุด">
        {labels.length >= 2 ? (
          <>
            <TrendLines labels={labels} series={series} />
            <div className="flex flex-wrap gap-2 text-xs">
              {series.map((s) => (
                <span key={s.name} className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-0.5">
                  <span className="inline-block w-5 border-t-[3px]" style={{ borderColor: s.color, borderTopStyle: s.dash ? "dashed" : "solid" }} aria-hidden="true" />
                  {s.name}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">ตอนนี้มีรอบที่คำนวณผลแล้วถึงรอบนี้เพียงรอบเดียว กราฟแนวโน้มจะขึ้นเมื่อมีรอบที่สอง</p>
        )}
      </ChartCard>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <ChartCard title="เปลี่ยนแปลงจากรอบก่อน" hint="คนที่ขึ้นและลงมากที่สุด (จุดเปอร์เซ็นต์) เทียบกับรอบก่อนหน้าที่คนนั้นถูกประเมิน">
          <MoveBars rows={[...ups, ...downs].map((p) => ({ name: p.name, team: p.department, delta: p.delta as number }))} />
        </ChartCard>
        <ChartCard title="ตารางสีรายทีมรายรอบ" hint="แบบเดียวกับชีตของฝ่ายบุคคล">
          {h.rounds.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลรอบ</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ทีม</TableHead>
                  {labels.map((l, i) => (
                    <TableHead key={`${l}-${i}`} className="text-center" title={h.rounds[i]?.name}>
                      {l}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {h.teams.map((t) => (
                  <TableRow key={t.department}>
                    <TableCell className="whitespace-normal">{t.department}</TableCell>
                    {t.values.map((v, i) => (
                      <ScoreCell key={i} value={v} />
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <ToneLegend />
        </ChartCard>
      </div>
    </div>
  );
}

/* ─────────────────────────────── สรุปรายคน ─────────────────────────────── */

export function PeopleTab({ data, people, onOpen }: { data: DetailOverview; people: DetailPerson[]; onOpen: (id: string) => void }) {
  const avg = mean(people.map((p) => p.total));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToneLegend values={people.map((p) => p.total)} />
        <Button
          variant="outline"
          className="ml-auto h-11 md:h-9 print:hidden"
          disabled={people.length === 0}
          onClick={() =>
            downloadCsv(
              `สรุปรายคน ${data.roundName}.csv`,
              ["No.", "ชื่อเล่น", "แผนก", "จำนวนผู้ประเมิน", "%", "รอบก่อน (%)"],
              people.map((p, i) => [i + 1, p.name, p.department, p.raters, fmt(p.total), fmt(p.prev)]),
            )
          }
        >
          <Download className="size-4" /> Export
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <RankHead />
            <TableHead>ชื่อเล่น</TableHead>
            <TableHead>แผนก</TableHead>
            <TableHead className="text-center">จำนวนผู้ประเมิน</TableHead>
            <TableHead className="text-center">%</TableHead>
            <TableHead className="text-center">เทียบรอบก่อน</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.map((p, i) => (
            <TableRow key={p.participantId}>
              <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
              <TableCell>
                <NameButton p={p} onOpen={onOpen} />
              </TableCell>
              <TableCell className="whitespace-normal">{p.department}</TableCell>
              <TableCell className="text-center tabular-nums">{p.raters || "-"}</TableCell>
              <ScoreCell value={p.total} />
              <TableCell className="text-center">
                <Delta value={p.delta} />
              </TableCell>
            </TableRow>
          ))}
          {people.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                ไม่พบคนที่ค้นหา
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {people.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>รวม {people.length} คน</TableCell>
              <TableCell className="text-center tabular-nums">{people.reduce((s, p) => s + p.raters, 0)}</TableCell>
              <TableCell className="text-center tabular-nums">{fmt(avg)}%</TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        )}
      </Table>
      <p className="text-xs text-muted-foreground">เรียงจากคะแนนสูงไปต่ำ กดชื่อเพื่อเปิดรายละเอียดของคนนั้น (ใครประเมินใคร ให้กี่คะแนน ความเห็น)</p>
    </div>
  );
}

/* ─────────────────────────────── เทียบรายเดือน ─────────────────────────────── */

export function MonthsTab({ data, people, onOpen, children }: { data: DetailOverview; people: DetailPerson[]; onOpen: (id: string) => void; children?: React.ReactNode }) {
  const h = data.history;
  const byEmployee = new Map(h.people.map((x) => [x.employeeId, x.values]));
  // Two rounds in the same month would share a heading, so repeated labels are numbered.
  const seen = new Map<string, number>();
  const labels = h.rounds.map((r) => {
    const c = (seen.get(r.label) ?? 0) + 1;
    seen.set(r.label, c);
    return { text: r.label, count: c, name: r.name };
  });
  const total = (l: string) => labels.filter((x) => x.text === l).length;
  const heads = labels.map((l) => (total(l.text) > 1 ? `${l.text} (${l.count})` : l.text));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToneLegend />
        <Button
          variant="outline"
          className="ml-auto h-11 md:h-9 print:hidden"
          disabled={people.length === 0}
          onClick={() => downloadCsv(`เทียบรายเดือน ${data.roundName}.csv`, ["No.", "ชื่อเล่น", "แผนก", ...heads], people.map((p, i) => [i + 1, p.name, p.department, ...(byEmployee.get(p.employeeId) ?? heads.map(() => null)).map((v) => fmt(v))]))}
        >
          <Download className="size-4" /> Export
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <RankHead />
            <TableHead>ชื่อเล่น</TableHead>
            <TableHead>แผนก</TableHead>
            {heads.map((l, i) => (
              <TableHead key={l} className="text-center" title={labels[i]?.name}>
                {l}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.map((p, i) => (
            <TableRow key={p.participantId}>
              <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
              <TableCell>
                <NameButton p={p} onOpen={onOpen} />
              </TableCell>
              <TableCell className="whitespace-normal">{p.department}</TableCell>
              {heads.map((l, k) => (
                <ScoreCell key={l} value={byEmployee.get(p.employeeId)?.[k] ?? null} />
              ))}
            </TableRow>
          ))}
          {people.length === 0 && (
            <TableRow>
              <TableCell colSpan={3 + heads.length} className="text-muted-foreground">
                ไม่พบคนที่ค้นหา
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">แต่ละคอลัมน์คือหนึ่งรอบ เรียงจากเก่าไปใหม่ (วางเมาส์ที่หัวคอลัมน์เพื่อดูชื่อรอบ) เรียงแถวตามคะแนนรอบที่เลือก “-” คือไม่ได้ถูกประเมินในรอบนั้น</p>
      {children}
    </div>
  );
}

/* ─────────────────────────────── คะแนนรายหมวดและความเห็น ─────────────────────────────── */

export function SectionsTab({ data, people, onOpen }: { data: DetailOverview; people: DetailPerson[]; onOpen: (id: string) => void }) {
  const names = data.sectionNames;
  if (names.length === 0)
    return <p className="rounded-sm border border-border bg-card p-4 text-sm text-muted-foreground">รอบนี้ไม่มีคะแนนแยกตามหมวด (คะแนนอาจนำเข้าจากระบบเดิม มีเฉพาะคะแนนรวมกับความเห็น) ดูคะแนนรวมได้ที่แท็บ สรุปรายคน</p>;
  const avgOf = (k: number) => mean(people.map((p) => p.sections[k]).filter((v): v is number => v !== null && v !== undefined));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToneLegend />
        <Button
          variant="outline"
          className="ml-auto h-11 md:h-9 print:hidden"
          disabled={people.length === 0}
          onClick={() => downloadCsv(`คะแนนรายหมวด ${data.roundName}.csv`, ["No.", "ชื่อเล่น", "แผนก", ...names, "คะแนนรวม (%)", "ความเห็น"], people.map((p, i) => [i + 1, p.name, p.department, ...names.map((_, k) => fmt(p.sections[k])), fmt(p.total), p.comment]))}
        >
          <Download className="size-4" /> Export
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <RankHead />
            <TableHead>ชื่อเล่น</TableHead>
            {names.map((s) => (
              <TableHead key={s} className="min-w-24 text-center whitespace-normal">
                {s}
              </TableHead>
            ))}
            <TableHead className="text-center">คะแนนรวม</TableHead>
            <TableHead>ความเห็น</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.map((p, i) => (
            <TableRow key={p.participantId}>
              <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
              <TableCell>
                <NameButton p={p} onOpen={onOpen} />
              </TableCell>
              {names.map((s, k) => (
                <ScoreCell key={s} value={p.sections[k] ?? null} suffix="" only={["low"]} />
              ))}
              <ScoreCell value={p.total} />
              <TableCell className="max-w-[22rem] min-w-56 whitespace-normal text-sm">
                <span className="line-clamp-3" title={p.comment}>
                  {p.comment || "-"}
                </span>
              </TableCell>
            </TableRow>
          ))}
          {people.length === 0 && (
            <TableRow>
              <TableCell colSpan={names.length + 4} className="text-muted-foreground">
                ไม่พบคนที่ค้นหา
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {people.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>เฉลี่ยทั้งรอบ</TableCell>
              {names.map((s, k) => (
                <TableCell key={s} className="text-center tabular-nums">
                  {fmt(avgOf(k))}
                </TableCell>
              ))}
              <TableCell className="text-center tabular-nums">{fmt(mean(people.map((p) => p.total)))}%</TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        )}
      </Table>
      <p className="text-xs text-muted-foreground">คะแนนแต่ละหมวดเป็นเปอร์เซ็นต์ของคะแนนเต็ม ระบายสีเฉพาะช่องที่ต่ำกว่า 80 เพื่อให้เห็นว่าใครควรดู ความเห็นแสดงสามบรรทัดแรก เอาเมาส์วางเพื่ออ่านทั้งหมด หรือกดชื่อเพื่อเปิดใบเต็ม</p>
    </div>
  );
}

/* ─────────────────────────────── รายทีม ─────────────────────────────── */

export function TeamTab({ data }: { data: DetailOverview }) {
  const [team, setTeam] = useState<string | null>(null);
  const members = team ? data.people.filter((p) => p.department === team) : [];
  const company = data.companyAvg;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToneLegend />
        <Button
          variant="outline"
          className="ml-auto h-11 md:h-9 print:hidden"
          disabled={data.teams.length === 0}
          onClick={() => downloadCsv(`รายทีม ${data.roundName}.csv`, ["No.", "ทีม", "คน", "เฉลี่ย (%)", "ต่ำสุด", "สูงสุด", "เทียบรอบก่อน", "เทียบบริษัท"], data.teams.map((t, i) => [i + 1, t.department, t.count, fmt(t.avg), fmt(t.min), fmt(t.max), fmt(t.delta), company === null ? "-" : fmt(r1(t.avg - company))]))}
        >
          <Download className="size-4" /> Export
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <RankHead />
            <TableHead>ทีม</TableHead>
            <TableHead className="text-center">คน</TableHead>
            <TableHead className="text-center">เฉลี่ย (%)</TableHead>
            <TableHead className="text-center">ต่ำสุด</TableHead>
            <TableHead className="text-center">สูงสุด</TableHead>
            <TableHead className="text-center">เทียบรอบก่อน</TableHead>
            <TableHead className="text-center">เทียบบริษัท</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.teams.map((t, i) => (
            <TableRow key={t.department}>
              <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
              <TableCell className="whitespace-normal">
                <button type="button" aria-expanded={team === t.department} className="inline-flex min-h-11 items-center text-left font-medium text-primary hover:underline md:min-h-0" onClick={() => setTeam(team === t.department ? null : t.department)}>
                  {t.department}
                </button>
              </TableCell>
              <TableCell className="text-center tabular-nums">{t.count}</TableCell>
              <ScoreCell value={t.avg} />
              <TableCell className="text-center tabular-nums">{fmt(t.min)}</TableCell>
              <TableCell className="text-center tabular-nums">{fmt(t.max)}</TableCell>
              <TableCell className="text-center">
                <Delta value={t.delta} />
              </TableCell>
              <TableCell className="text-center">
                <Delta value={company === null ? null : r1(t.avg - company)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>ทั้งบริษัท</TableCell>
            <TableCell className="text-center tabular-nums">{data.people.length}</TableCell>
            <TableCell className="text-center tabular-nums">{fmt(company)}%</TableCell>
            <TableCell colSpan={4} />
          </TableRow>
        </TableFooter>
      </Table>
      <p className="text-xs text-muted-foreground">เรียงจากทีมที่เฉลี่ยสูงไปต่ำ กดชื่อทีมเพื่อดูรายคนในทีม</p>
      {team && (
        <div>
          <h4 className="mb-1.5 text-sm font-semibold">
            คนในทีม {team} ({members.length} คน)
          </h4>
          <Table>
            <TableHeader>
              <TableRow>
                <RankHead />
                <TableHead>ชื่อเล่น</TableHead>
                <TableHead className="text-center">จำนวนผู้ประเมิน</TableHead>
                <TableHead className="text-center">%</TableHead>
                <TableHead className="text-center">เทียบรอบก่อน</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m, i) => (
                <TableRow key={m.participantId}>
                  <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                  <TableCell>{m.name}</TableCell>
                  <TableCell className="text-center tabular-nums">{m.raters || "-"}</TableCell>
                  <ScoreCell value={m.total} />
                  <TableCell className="text-center">
                    <Delta value={m.delta} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
