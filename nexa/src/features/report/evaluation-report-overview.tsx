"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CEILING_MIN_PEOPLE, CEILING_SHARE } from "@/features/appraisal-round/review-rules";
import { cn } from "@/lib/utils";
import type { RoundInsight, ScoredPerson } from "./result-insights";

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

      <section aria-label="การกระจายคะแนน">
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

      <div className="grid gap-4 md:grid-cols-2">
        <Ranking title="คะแนนสูงสุด" people={r.top} tied={r.topTied} />
        <Ranking title="คะแนนต่ำสุด" people={r.bottom} tied={r.bottomTied} />
      </div>

      <section aria-label="สรุปรายแผนก">
        <h4 className="text-sm font-semibold">สรุปรายแผนก</h4>
        <div className="border-border mt-2 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">แผนก</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">คน</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">เฉลี่ย (%)</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">ต่ำสุด</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">สูงสุด</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">ได้ 100%</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {r.departments.map((d) => (
                <tr key={d.name}>
                  <td className="px-3 py-2 break-words">{d.name}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{d.count}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(d.average)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(d.min)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmt(d.max)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.atTop}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Card>
  );
}

function Tile({ label, value, warn, note }: { label: string; value: string; warn?: boolean; note?: string }) {
  return (
    <div className={cn("rounded-xl border p-3", warn ? "border-status-late-border bg-status-late-bg" : "border-border bg-card")}>
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
