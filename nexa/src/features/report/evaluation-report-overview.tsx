"use client";

import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { ArrowDown, ArrowUp, Minus, TriangleAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CEILING_MIN_PEOPLE, CEILING_SHARE } from "@/features/appraisal-round/review-rules";
import { cn } from "@/lib/utils";
import { compareRounds, DROP_LOOK_POINTS, previousRoundOf, TREND_MIN_POINTS, trendOf, type RoundComparison, type RoundInsight, type ScoredPerson, type Trend } from "./result-insights";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const share = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

/**
 * The overview above the evaluation report: for one round, the spread of scores, the highest and lowest ten and a summary per
 * department. It uses the same rows as the table below (approved or published results only), so nobody sees a score here that the
 * table would not show them, and it works before any grade bands are set.
 */
export function EvaluationReportOverview({ rounds }: { rounds: RoundInsight[] }) {
  const [id, setId] = useState(rounds[0]?.id ?? "");
  const r = rounds.find((x) => x.id === id) ?? rounds[0];
  if (!r) return null;
  const ceiling = r.count >= CEILING_MIN_PEOPLE && r.atTop / r.count >= CEILING_SHARE;
  const prev = previousRoundOf(rounds, r.id);
  const cmp = prev ? compareRounds(r, prev) : undefined;

  return (
    <Card className="gap-4 p-4 print:break-inside-avoid" aria-label="ภาพรวมผลประเมิน">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-heading text-base font-semibold">ภาพรวมผลประเมิน</h3>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground text-sm">รอบ</span>
          <Select value={r.id} onValueChange={(v) => v && setId(v as string)}>
            <SelectTrigger className="h-11 max-w-[min(70vw,420px)] md:h-9" aria-label="เลือกรอบ">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rounds.map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {x.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
      </div>


      <ReportHub hasCompare={!!cmp} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="คนที่ถูกประเมิน" value={`${r.count} คน`} />
        <Tile label="คะแนนเฉลี่ย" value={`${fmt(r.average)}%`} />
        <Tile label="ต่ำสุด ถึง สูงสุด" value={`${fmt(r.min)} ถึง ${fmt(r.max)}`} />
        <Tile
          label="ได้ 100%"
          value={`${r.atTop} คน (${share(r.atTop, r.count)}%)`}
          warn={ceiling}
          note={ceiling ? "คะแนนกระจุกที่เต็ม แยกคนที่ทำได้ดีกว่ากันไม่ได้" : undefined}
        />
      </div>

      <section id="score-bands" className="scroll-mt-48" aria-label="การกระจายคะแนน">
        <h4 className="text-sm font-semibold">การกระจายคะแนน</h4>
        <ul className="mt-2 space-y-2">
          {r.bands.map((b, i) => {
            const last = i === r.bands.length - 1;
            return (
              <li key={b.label} className="grid grid-cols-[5rem_1fr_7.5rem] items-center gap-x-3 text-sm">
                <span>{b.label}</span>
                <span className="bg-muted h-4 overflow-hidden rounded-full" aria-hidden="true">
                  <span className={cn("block h-full rounded-full", last && ceiling ? "bg-warning" : "bg-primary")} style={{ width: `${share(b.count, r.count)}%` }} />
                </span>
                <span className="text-muted-foreground text-right tabular-nums">
                  {b.count} คน ({share(b.count, r.count)}%)
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div id="top-ten" className="grid scroll-mt-48 gap-4 md:grid-cols-2">
        <Ranking title="คะแนนสูงสุด" people={r.top} tied={r.topTied} />
        <Ranking title="คะแนนต่ำสุด" people={r.bottom} tied={r.bottomTied} />
      </div>

      {cmp && <Comparison cmp={cmp} currentName={r.name} />}

      <section id="departments" className="scroll-mt-48" aria-label="สรุปรายแผนก">
        <h4 className="text-sm font-semibold">สรุปรายแผนก</h4>
        <div className="mt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>แผนก</TableHead>
                <TableHead className="text-right">คน</TableHead>
                <TableHead className="text-right">เฉลี่ย (%)</TableHead>
                <TableHead className="text-right">ต่ำสุด</TableHead>
                <TableHead className="text-right">สูงสุด</TableHead>
                <TableHead className="text-right">ได้ 100%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.departments.map((d) => (
                <TableRow key={d.name}>
                  <TableCell className="whitespace-normal">{d.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.count}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(d.average)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(d.min)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(d.max)}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.atTop}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </Card>
  );
}

/** Favpo's report page: three boxes of plain link rows (per person, per department, comparison) that jump to the report on this page or open the page that has it. */
function ReportHub({ hasCompare }: { hasCompare: boolean }) {
  const groups: { title: string; links: { href: string; label: string; page?: boolean }[] }[] = [
    {
      title: "สรุป (พนักงาน)",
      links: [
        { href: "#report-table", label: "รายงานสรุปรายพนักงาน" },
        { href: "#score-bands", label: "รายงานสรุปคะแนน (ระดับผลการประเมิน)" },
        { href: "#top-ten", label: "รายงานสรุป 10 อันดับคะแนน" },
        { href: "/performance", label: "9 Box Grid (สมรรถนะ / KPI)", page: true },
        { href: "/appraisal/report", label: "รายงานประเมินละเอียด (ใครประเมินใคร คะแนน ความเห็น กราฟ)", page: true },
      ],
    },
    {
      title: "สรุป (แผนก / ระดับพนักงาน / ตำแหน่ง)",
      links: [
        { href: "#departments", label: "รายงานสรุปคะแนนรายแผนก" },
        { href: "#score-bands", label: "รายงานสรุปจำนวนระดับผลการประเมิน (ข้อมูล)" },
      ],
    },
    {
      title: "รายงานเปรียบเทียบ",
      links: hasCompare
        ? [{ href: "#compare", label: "รายงานเปรียบเทียบกับรอบก่อน (รายแผนก / รายพนักงาน)" }]
        : [],
    },
  ];
  return (
    <section aria-label="รายงานประเมินพนักงาน" className="grid gap-4 md:grid-cols-3 print:hidden">
      {groups.map((g) => (
        <div key={g.title}>
          <h4 className="mb-2 text-base font-medium">{g.title}</h4>
          <div className="divide-border border-border divide-y rounded-sm border">
            {g.links.length === 0 ? (
              <p className="text-muted-foreground px-3 py-2 text-sm">ยังไม่มีรอบก่อนที่เทียบได้</p>
            ) : (
              g.links.map((l) =>
                l.page ? (
                  <Link key={l.label} href={l.href} className="hover:text-primary flex min-h-11 items-center px-3 py-2 text-sm hover:bg-[#f6f9fe]">
                    {l.label}
                  </Link>
                ) : (
                  <a key={l.label} href={l.href} className="hover:text-primary flex min-h-11 items-center px-3 py-2 text-sm hover:bg-[#f6f9fe]">
                    {l.label}
                  </a>
                ),
              )
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

const TREND_TEXT: Record<Trend, string> = { up: "ดีขึ้น", down: "ลดลง", same: "เท่าเดิม" };
const TREND_ICON = { up: ArrowUp, down: ArrowDown, same: Minus } as const;
const TREND_CLASS: Record<Trend, string> = {
  up: "border-status-normal-border bg-status-normal-bg text-status-normal-fg",
  down: "border-status-absent-border bg-status-absent-bg text-status-absent-fg",
  same: "border-border bg-muted text-muted-foreground",
};

/** A change in points with an arrow and a word (never colour alone). `min` is how many points count as a real change. */
function Delta({ value, min = TREND_MIN_POINTS }: { value: number | null; min?: number }) {
  if (value === null) return <span className="text-muted-foreground">ไม่มีรอบก่อน</span>;
  const t = trendOf(value, min);
  const Icon = TREND_ICON[t];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm border px-2 py-px text-xs font-semibold tabular-nums", TREND_CLASS[t])}>
      <Icon className="size-3" aria-hidden="true" />
      {TREND_TEXT[t]} {value > 0 ? "+" : ""}
      {fmt(value)}
    </span>
  );
}

/** "เทียบกับรอบก่อน": average and each department against the round before, plus the people whose score fell or rose most. */
function Comparison({ cmp, currentName }: { cmp: RoundComparison; currentName: string }) {
  return (
    <section id="compare" aria-label="เทียบกับรอบก่อน" className="scroll-mt-48 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold">เทียบกับรอบก่อน</h4>
        <Delta value={cmp.averageDelta} />
        <span className="text-muted-foreground text-xs">
          {currentName} เทียบกับ {cmp.previous.name} · มีคนอยู่ในทั้งสองรอบ {cmp.shared} คน
        </span>
      </div>
      <div className="border-border overflow-x-auto rounded-sm border">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="border-border border-r border-b px-3 py-2 text-left text-[13px] font-bold">แผนก</th>
              <th scope="col" className="border-border border-r border-b px-2 py-2 text-right text-[13px] font-bold">รอบก่อน (%)</th>
              <th scope="col" className="border-border border-r border-b px-2 py-2 text-right text-[13px] font-bold">รอบนี้ (%)</th>
              <th scope="col" className="border-border border-b px-3 py-2 text-left text-[13px] font-bold">เปลี่ยนแปลง</th>
            </tr>
          </thead>
          <tbody>
            {cmp.departments.map((d) => (
              <tr key={d.name}>
                <td className="border-border border-r border-b px-3 py-2 break-words">{d.name}</td>
                <td className="border-border border-r border-b px-2 py-2 text-right tabular-nums">{d.before === null ? "-" : fmt(d.before)}</td>
                <td className="border-border border-r border-b px-2 py-2 text-right tabular-nums">{fmt(d.now)}</td>
                <td className="border-border border-b px-3 py-2">
                  <Delta value={d.delta} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <MoveList title={`คะแนนลดลงตั้งแต่ ${DROP_LOOK_POINTS} จุด (ควรดู)`} people={cmp.drops} empty="ไม่มีใครลดลงถึงเกณฑ์" />
        <MoveList title="คะแนนเพิ่มขึ้นมากสุด" people={cmp.rises} empty="ไม่มีใครเพิ่มขึ้น" />
      </div>
      <p className="text-muted-foreground text-xs">
        เกณฑ์ตั้งต้น (รอ HR ยืนยัน): ถือว่าดีขึ้นหรือลดลงเมื่อค่าเฉลี่ยเปลี่ยน {TREND_MIN_POINTS} จุดขึ้นไป และเรียกว่า “ควรดู” เมื่อคะแนนรายคนลดลง {DROP_LOOK_POINTS} จุดขึ้นไป ตัวเลขนี้ใช้เป็นป้ายเท่านั้น ไม่มีผลกับคะแนนหรือเกรด
      </p>
    </section>
  );
}

function MoveList({ title, people, empty }: { title: string; people: RoundComparison["drops"]; empty: string }) {
  return (
    <div>
      <h5 className="text-sm font-semibold">{title}</h5>
      {people.length === 0 ? (
        <p className="text-muted-foreground mt-1 text-sm">{empty}</p>
      ) : (
        <ol className="mt-1 space-y-1.5">
          {people.slice(0, 10).map((p) => (
            <li key={`${p.name}-${p.department}`} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 break-words">
                {p.name} <span className="text-muted-foreground text-xs">{p.department}</span>
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {fmt(p.before)} ถึง {fmt(p.now)}
              </span>
              <Delta value={p.delta} min={1} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Tile({ label, value, warn, note }: { label: string; value: string; warn?: boolean; note?: string }) {
  return (
    <div className={cn("rounded-lg border p-3", warn ? "border-status-late-border bg-status-late-bg" : "border-border bg-card")}>
      <p className={cn("text-xs", warn ? "text-status-late-fg" : "text-muted-foreground")}>{label}</p>
      <p className={cn("text-xl font-bold tabular-nums", warn && "text-status-late-fg")}>{value}</p>
      {note && (
        <p className="text-status-late-fg mt-0.5 flex items-start gap-1 text-xs">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" /> {note}
        </p>
      )}
    </div>
  );
}

function Ranking({ title, people, tied }: { title: string; people: ScoredPerson[]; tied: number }) {
  return (
    <section aria-label={title}>
      <h4 className="text-sm font-semibold">
        {title} {people.length} คน
      </h4>
      <p className="text-muted-foreground text-xs">
        {tied > 0 ? `อีก ${tied} คนได้คะแนนเท่าอันดับที่ ${people.length} ไม่ได้แสดง คนที่คะแนนเท่ากันเรียงตามชื่อ` : "คนที่คะแนนเท่ากันเรียงตามชื่อ"}
      </p>
      <ol className="divide-border mt-1 divide-y">
        {people.map((p, i) => (
          <li key={`${p.code}-${i}`} className="flex items-center gap-3 py-1.5">
            <span className="text-muted-foreground w-5 text-right text-xs tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="block break-words font-semibold">{p.name}</span>
              <span className="text-muted-foreground block text-xs">{p.department}</span>
            </span>
            <span className="font-bold tabular-nums">{fmt(p.percent)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
