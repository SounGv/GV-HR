"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { ChartBox, ColumnChart, PairedColumns, Segmented, Sparkline, toneFill, type PairRow } from "./detail-report-svg";
import { Delta, fmt } from "./detail-report-tables";
import type { DetailOverview } from "./detail-report-types";
import { MIN_TEAM_SIZE } from "./exec-summary-rules";

/**
 * Charts above the by-round table (appraisal-boss-overview-mock.html, tab เทียบรายรอบ): the company average by round, any two
 * rounds side by side (rows or vertical columns), and one small line per team. Reads the same history as the table.
 */
export function MonthlyCharts({ data }: { data: DetailOverview }) {
  const h = data.history;
  const n = h.rounds.length;
  const labels = h.rounds.map((r) => r.label);
  const [a, setA] = useState(Math.max(0, n - 2));
  const [b, setB] = useState(Math.max(0, n - 1));
  const [mode, setMode] = useState<"rows" | "cols">("rows");
  const big = useMemo(() => new Set(data.teams.filter((t) => t.count >= MIN_TEAM_SIZE).map((t) => t.department)), [data.teams]);
  const teams = h.teams.filter((t) => big.has(t.department));
  if (n < 2) return null;

  const rows: PairRow[] = [
    { name: "ทั้งบริษัท", a: h.company[a] ?? null, b: h.company[b] ?? null },
    ...teams.map((t) => ({ name: t.department.replace(/^แผนก/, ""), a: t.values[a] ?? null, b: t.values[b] ?? null })),
  ];

  return (
    <div className="space-y-4 print:hidden">
      <Card className="gap-2 p-4">
        <h3 className="text-base font-semibold">ค่าเฉลี่ยบริษัทรายรอบ</h3>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center">
          <ChartBox min={520}>
            <ColumnChart values={h.company} labels={labels} label={`ค่าเฉลี่ยบริษัทรายรอบ: ${labels.map((l, i) => `${l} ${fmt(h.company[i])}`).join(", ")}`} />
          </ChartBox>
          <ul className="divide-y divide-border text-sm" aria-label="ค่าเฉลี่ยบริษัทแต่ละรอบ">
            {labels.map((l, i) => {
              const cur = h.company[i];
              const prev = i > 0 ? h.company[i - 1] : null;
              return (
                <li key={`${l}-${i}`} className="flex items-center justify-between gap-3 py-2">
                  <span>{l}</span>
                  <span className="flex items-baseline gap-2 tabular-nums">
                    <b className="text-base">{fmt(cur)}</b>
                    <Delta value={cur !== null && prev !== null ? Math.round((cur - prev) * 10) / 10 : null} />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">แท่งสีตามช่วงคะแนน (เขียว 90 ขึ้นไป · เหลือง 80–89 · แดงต่ำกว่า 80) · ▲▼ ใต้รอบคือเปลี่ยนจากรอบก่อน</p>
      </Card>

      <Card className="gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">เทียบ 2 รอบ</h3>
          <Segmented value={mode} onChange={setMode} label="ทิศทางของแท่ง" options={[{ value: "rows", label: "แนวนอน" }, { value: "cols", label: "แนวตั้ง" }]} />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            จาก
            <RoundSelect value={a} onChange={setA} labels={labels} />
          </label>
          <label className="flex items-center gap-2">
            เป็น
            <RoundSelect value={b} onChange={setB} labels={labels} />
          </label>
        </div>
        {mode === "cols" ? (
          <ChartBox min={560}>
            <PairedColumns rows={rows} label={`เทียบ ${labels[a]} กับ ${labels[b]} แต่ละทีม`} legend={[labels[a] ?? "รอบแรก", labels[b] ?? "รอบหลัง"]} />
          </ChartBox>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.name} className="grid gap-1 py-2 md:grid-cols-[10rem_1fr_14rem] md:items-center md:gap-3">
                <b className="leading-snug">{r.name}</b>
                <span className="grid gap-1" aria-hidden="true">
                  <span className="block h-2.5 rounded-full bg-[var(--chart-muted-bar)]" style={{ width: `${r.a ?? 0}%` }} />
                  <span className="block h-2.5 rounded-full" style={{ width: `${r.b ?? 0}%`, background: r.b === null ? "transparent" : toneFill(r.b) }} />
                </span>
                <span className="text-sm tabular-nums md:text-right">
                  {fmt(r.a)} → <b>{fmt(r.b)}</b> <Delta value={r.a !== null && r.b !== null ? Math.round((r.b - r.a) * 10) / 10 : null} />
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">แท่งเทา = รอบที่เลือกก่อน · แท่งสี = รอบที่เทียบ (สีตามช่วงคะแนน){mode === "cols" ? " · แกนเริ่มที่ 50 เพื่อให้เห็นความต่างชัด" : ""}</p>
      </Card>

      {teams.length > 0 && (
        <Card className="gap-3 p-4">
          <h3 className="text-base font-semibold">แนวโน้มแต่ละทีม</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((t) => {
              const last = [...t.values].reverse().find((v) => v !== null) ?? null;
              const lastIdx = t.values.lastIndexOf(last);
              const before = lastIdx > 0 ? t.values.slice(0, lastIdx).reverse().find((v) => v !== null) ?? null : null;
              return (
                <div key={t.department} className="rounded-lg border border-border p-3">
                  <b className="block leading-snug">{t.department}</b>
                  <span className="text-xs text-muted-foreground">{labels[0]} ถึง {labels[n - 1]}</span>
                  <div className="max-w-[360px]">
                    <Sparkline values={t.values} label={`แนวโน้มของ ${t.department}`} />
                  </div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <b className={cn("text-lg tabular-nums")}>{fmt(last)}%</b>
                    <Delta value={last !== null && before !== null ? Math.round((last - before) * 10) / 10 : null} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">เส้นประเขียว = 90 · เส้นประแดง = 80 · จุดสุดท้ายสีตามช่วงคะแนนของรอบล่าสุด · แสดงเฉพาะทีมที่มีตั้งแต่ {MIN_TEAM_SIZE} คน</p>
        </Card>
      )}
    </div>
  );
}

function RoundSelect({ value, onChange, labels }: { value: number; onChange: (i: number) => void; labels: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 rounded-md border border-input bg-card px-3 text-sm md:h-9" aria-label="เลือกรอบ">
      {labels.map((l, i) => (
        <option key={`${l}-${i}`} value={i}>
          {l}
        </option>
      ))}
    </select>
  );
}
