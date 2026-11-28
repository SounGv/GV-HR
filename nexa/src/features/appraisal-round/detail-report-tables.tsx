"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Download, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DistributionChart } from "./detail-report-charts";
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
  high: "bg-status-normal-bg/60 text-status-normal-fg",
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

const NameButton = ({ p, onOpen, wrap }: { p: DetailPerson; onOpen: (id: string) => void; wrap?: boolean }) => (
  <button type="button" onClick={() => onOpen(p.participantId)} className={cn("inline-flex min-h-11 items-center text-left font-medium text-primary hover:underline md:min-h-0", wrap ? "whitespace-normal" : "whitespace-nowrap")}>
    {p.name}
  </button>
);

/** The score colour as a small pill, for the phone lists (the tables colour whole cells instead). */
function ScorePill({ value, suffix = "%", only }: { value: number | null | undefined; suffix?: string; only?: ScoreTone[] }) {
  if (value === null || value === undefined) return <span className="inline-block min-w-12 text-center text-sm text-muted-foreground">-</span>;
  const tone = toneOf(value);
  return <span className={cn("inline-block min-w-14 rounded-sm px-2 py-0.5 text-center text-sm font-medium tabular-nums", (!only || only.includes(tone)) && TONE_CLASS[tone])}>{`${fmt(value)}${suffix}`}</span>;
}

const PHONE_LIST = "divide-y divide-border rounded-sm border border-border bg-card md:hidden";
const Rank = ({ n }: { n: number }) => <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{n}</span>;

const RankHead = () => <TableHead className="w-12 text-center">No.</TableHead>;

/* ─────────────────────────────── ภาพรวม (ผู้บริหาร) ─────────────────────────────── */

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

/** How many people fall in each score range; the only block of the old overview tab that no other tab shows. */
export function DistributionCard({ data }: { data: DetailOverview }) {
  const bands = data.bins.map((b) => ({ label: b.label, count: data.people.filter((p) => p.total >= b.from && p.total <= b.to).length }));
  return (
    <ChartCard title="การกระจายคะแนน" hint="จำนวนคนในแต่ละช่วงคะแนน">
      <DistributionChart bands={bands} />
    </ChartCard>
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
              ["No.", "ชื่อ (ชื่อเล่น)", "แผนก", "จำนวนผู้ประเมิน", "%", "รอบก่อน (%)"],
              people.map((p, i) => [i + 1, p.name, p.department, p.raters, fmt(p.total), fmt(p.prev)]),
            )
          }
        >
          <Download className="size-4" /> Export
        </Button>
      </div>
      <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <RankHead />
            <TableHead>ชื่อ (ชื่อเล่น)</TableHead>
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
      </div>
      <ul className={PHONE_LIST}>
        {people.map((p, i) => (
          <li key={p.participantId} className="flex items-center gap-3 px-3 py-2">
            <Rank n={i + 1} />
            <div className="min-w-0 flex-1">
              <NameButton p={p} onOpen={onOpen} wrap />
              <p className="text-xs text-muted-foreground">
                {p.department} · ผู้ประเมิน {p.raters || "-"} คน
              </p>
            </div>
            <div className="shrink-0 text-right">
              <ScorePill value={p.total} />
              <div className="mt-0.5 text-xs">
                <Delta value={p.delta} />
              </div>
            </div>
          </li>
        ))}
        {people.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">ไม่พบคนที่ค้นหา</li>}
        {people.length > 0 && (
          <li className="flex justify-between bg-muted/50 px-3 py-2 text-sm font-medium">
            <span>รวม {people.length} คน</span>
            <span className="tabular-nums">เฉลี่ย {fmt(avg)}%</span>
          </li>
        )}
      </ul>
      <p className="text-xs text-muted-foreground">เรียงจากคะแนนสูงไปต่ำ กดชื่อเพื่อเปิดรายละเอียดของคนนั้น (ใครประเมินใคร ให้กี่คะแนน ความเห็น)</p>
    </div>
  );
}

/* ─────────────────────────────── เทียบรายเดือน ─────────────────────────────── */

export function MonthsTab({ data, people, onOpen, top, children }: { data: DetailOverview; people: DetailPerson[]; onOpen: (id: string) => void; /** Charts shown above the table. */ top?: React.ReactNode; children?: React.ReactNode }) {
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
      {top}
      <div className="flex flex-wrap items-center gap-2">
        <ToneLegend />
        <Button
          variant="outline"
          className="ml-auto h-11 md:h-9 print:hidden"
          disabled={people.length === 0}
          onClick={() => downloadCsv(`เทียบรายเดือน ${data.roundName}.csv`, ["No.", "ชื่อ (ชื่อเล่น)", "แผนก", ...heads], people.map((p, i) => [i + 1, p.name, p.department, ...(byEmployee.get(p.employeeId) ?? heads.map(() => null)).map((v) => fmt(v))]))}
        >
          <Download className="size-4" /> Export
        </Button>
      </div>
      <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <RankHead />
            <TableHead>ชื่อ (ชื่อเล่น)</TableHead>
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
      </div>
      <ul className={PHONE_LIST}>
        {people.map((p, i) => (
          <li key={p.participantId} className="px-3 py-2">
            <div className="flex items-center gap-3">
              <Rank n={i + 1} />
              <div className="min-w-0 flex-1">
                <NameButton p={p} onOpen={onOpen} wrap />
                <p className="text-xs text-muted-foreground">{p.department}</p>
              </div>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 pl-9">
              {heads.map((l, k) => (
                <span key={l} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title={labels[k]?.name}>
                  {l}
                  <ScorePill value={byEmployee.get(p.employeeId)?.[k] ?? null} />
                </span>
              ))}
            </div>
          </li>
        ))}
        {people.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">ไม่พบคนที่ค้นหา</li>}
      </ul>
      {heads.length < 2 && <p className="rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted-foreground">ตอนนี้มีรอบที่คำนวณผลแล้วเพียงรอบเดียว คอลัมน์จะเพิ่มเมื่อมีรอบถัดไป (รอบเก่าที่นำเข้าจาก Favpo ดูได้ที่หน้ารายงานสรุปรายพนักงาน)</p>}
      <p className="text-xs text-muted-foreground">แต่ละคอลัมน์คือหนึ่งรอบ เรียงจากเก่าไปใหม่ (วางเมาส์ที่หัวคอลัมน์เพื่อดูชื่อรอบ) เรียงแถวตามคะแนนรอบที่เลือก “-” คือไม่ได้ถูกประเมินในรอบนั้น</p>
      {children}
    </div>
  );
}

/* ─────────────────────────────── คะแนนรายหมวดและความเห็น ─────────────────────────────── */

export function SectionsTab({ data, people, onOpen }: { data: DetailOverview; people: DetailPerson[]; onOpen: (id: string) => void }) {
  // A form with no sections gives one catch-all column that only repeats the total, so it is left out; the comments still show.
  const idx = data.sectionNames.length > 1 ? data.sectionNames.map((_, k) => k) : [];
  const names = idx.map((k) => data.sectionNames[k]!);
  const avgOf = (k: number) => mean(people.map((p) => p.sections[k]).filter((v): v is number => v !== null && v !== undefined));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToneLegend />
        <Button
          variant="outline"
          className="ml-auto h-11 md:h-9 print:hidden"
          disabled={people.length === 0}
          onClick={() => downloadCsv(`คะแนนรายหมวด ${data.roundName}.csv`, ["No.", "ชื่อ (ชื่อเล่น)", "แผนก", ...names, "คะแนนรวม (%)", "ความเห็น"], people.map((p, i) => [i + 1, p.name, p.department, ...idx.map((k) => fmt(p.sections[k])), fmt(p.total), p.comment]))}
        >
          <Download className="size-4" /> Export
        </Button>
      </div>
      {names.length === 0 && <p className="rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted-foreground">แบบประเมินของรอบนี้ไม่ได้แบ่งหมวด จึงมีเฉพาะคะแนนรวมกับความเห็น</p>}
      {names.length > 0 && (
        <p className="text-sm text-muted-foreground">
          คะแนนรายหมวดเป็นค่าเฉลี่ยของทุกใบที่ส่ง ไม่ถ่วงน้ำหนักข้อและมุมมองผู้ประเมิน ส่วนคะแนนรวมถ่วงน้ำหนักแล้ว ตัวเลขจึงอาจต่างกัน
        </p>
      )}
      <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <RankHead />
            <TableHead>ชื่อ (ชื่อเล่น)</TableHead>
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
              {idx.map((k) => (
                <ScoreCell key={k} value={p.sections[k] ?? null} suffix="" only={["low"]} />
              ))}
              <ScoreCell value={p.total} />
              <TableCell className="max-w-[26rem] min-w-56 whitespace-normal text-sm">
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
              {idx.map((k) => (
                <TableCell key={k} className="text-center tabular-nums">
                  {fmt(avgOf(k))}
                </TableCell>
              ))}
              <TableCell className="text-center tabular-nums">{fmt(mean(people.map((p) => p.total)))}%</TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        )}
      </Table>
      </div>
      <ul className={PHONE_LIST}>
        {people.map((p, i) => (
          <li key={p.participantId} className="px-3 py-2">
            <div className="flex items-center gap-3">
              <Rank n={i + 1} />
              <div className="min-w-0 flex-1">
                <NameButton p={p} onOpen={onOpen} wrap />
                <p className="text-xs text-muted-foreground">{p.department}</p>
              </div>
              <ScorePill value={p.total} />
            </div>
            {names.length > 0 && (
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 pl-9 text-xs">
                {idx.map((k) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 text-muted-foreground">{data.sectionNames[k]}</span>
                    <ScorePill value={p.sections[k] ?? null} suffix="" only={["low"]} />
                  </div>
                ))}
              </div>
            )}
            {p.comment && <p className="mt-1.5 line-clamp-4 pl-9 text-sm">{p.comment}</p>}
          </li>
        ))}
        {people.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">ไม่พบคนที่ค้นหา</li>}
      </ul>
      <p className="text-xs text-muted-foreground">
        {names.length > 0 ? "คะแนนแต่ละหมวดเป็นเปอร์เซ็นต์ของคะแนนเต็ม ระบายสีเฉพาะช่องที่ต่ำกว่า 80 เพื่อให้เห็นว่าใครควรดู " : ""}ความเห็นแสดงสามบรรทัดแรก เอาเมาส์วางเพื่ออ่านทั้งหมด หรือกดชื่อเพื่อเปิดใบเต็ม
      </p>
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
      <div className="hidden md:block">
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
      </div>
      <ul className={PHONE_LIST}>
        {data.teams.map((tm, i) => (
          <li key={tm.department} className="flex items-center gap-3 px-3 py-2">
            <Rank n={i + 1} />
            <div className="min-w-0 flex-1">
              <button type="button" aria-expanded={team === tm.department} className="inline-flex min-h-11 items-center text-left font-medium text-primary hover:underline" onClick={() => setTeam(team === tm.department ? null : tm.department)}>
                {tm.department}
              </button>
              <p className="text-xs text-muted-foreground">
                {tm.count} คน · ต่ำสุด {fmt(tm.min)} · สูงสุด {fmt(tm.max)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <ScorePill value={tm.avg} />
              <div className="mt-0.5 flex items-center justify-end gap-1 text-xs">
                <Delta value={company === null ? null : r1(tm.avg - company)} />
                <span className="text-muted-foreground">จากบริษัท</span>
              </div>
            </div>
          </li>
        ))}
        <li className="flex justify-between bg-muted/50 px-3 py-2 text-sm font-medium">
          <span>ทั้งบริษัท {data.people.length} คน</span>
          <span className="tabular-nums">{fmt(company)}%</span>
        </li>
      </ul>
      <p className="text-xs text-muted-foreground">เรียงจากทีมที่เฉลี่ยสูงไปต่ำ กดชื่อทีมเพื่อดูรายคนในทีม</p>
      {team && (
        <div>
          <h4 className="mb-1.5 text-sm font-semibold">
            คนในทีม {team} ({members.length} คน)
          </h4>
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <RankHead />
                <TableHead>ชื่อ (ชื่อเล่น)</TableHead>
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
          <ul className={PHONE_LIST}>
            {members.map((m, i) => (
              <li key={m.participantId} className="flex items-center gap-3 px-3 py-2">
                <Rank n={i + 1} />
                <div className="min-w-0 flex-1 text-sm font-medium">
                  {m.name}
                  <p className="text-xs font-normal text-muted-foreground">ผู้ประเมิน {m.raters || "-"} คน</p>
                </div>
                <div className="shrink-0 text-right">
                  <ScorePill value={m.total} />
                  <div className="mt-0.5 text-xs">
                    <Delta value={m.delta} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
