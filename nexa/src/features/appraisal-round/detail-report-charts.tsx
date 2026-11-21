/**
 * The four charts of the executive overview in the detailed evaluation report: plain SVG in one blue family plus greys, with the
 * numbers written on the chart so nothing has to be read off an axis or a legend. Each chart is at least 460px wide inside a
 * scroll box, so on a phone the text keeps its size and the chart scrolls sideways instead of shrinking below 12px.
 */

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const DEEP = "#0d47a1";
const SOFT = "#90caf9";
const AXIS = "#e4e7ec";

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="overflow-x-auto" role="img" aria-label={label}>
      <div className="min-w-[460px]">{children}</div>
    </div>
  );
}

/** Columns: how many people in each score band. The last band (full marks) is the deeper blue. */
export function DistributionChart({ bands }: { bands: { label: string; count: number }[] }) {
  const W = 520;
  const H = 250;
  const L = 30;
  const Bm = 40;
  const Tp = 22;
  const max = Math.max(4, ...bands.map((b) => b.count));
  const bw = 52;
  const gap = (W - L - 10 - bw * bands.length) / Math.max(1, bands.length - 1);
  const y = (v: number) => Tp + (H - Bm - Tp) * (1 - v / max);
  const step = max > 8 ? 4 : 2;
  const grid: number[] = [];
  for (let g = 0; g <= max; g += step) grid.push(g);
  return (
    <Frame label="กราฟแท่งการกระจายคะแนน">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
        {grid.map((g) => (
          <g key={g}>
            <line x1={L} x2={W - 10} y1={y(g)} y2={y(g)} stroke={AXIS} />
            <text x={L - 6} y={y(g) + 4} textAnchor="end" fontSize="12" className="fill-muted-foreground">
              {g}
            </text>
          </g>
        ))}
        {bands.map((b, i) => {
          const x = L + 10 + i * (bw + gap);
          const last = i === bands.length - 1;
          return (
            <g key={b.label}>
              <rect x={x} y={y(b.count)} width={bw} height={(H - Bm - Tp) * (b.count / max)} rx="2" fill={last ? DEEP : "#1976d2"} />
              <text x={x + bw / 2} y={y(b.count) - 6} textAnchor="middle" fontSize="14" fontWeight="700" className="fill-foreground">
                {b.count}
              </text>
              <text x={x + bw / 2} y={H - 18} textAnchor="middle" fontSize="12" className="fill-muted-foreground">
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

/** One bar per team from zero to 100, with the company average as a dashed line. Teams at or above it are the deeper blue. */
export function TeamBars({ teams, company }: { teams: { name: string; count: number; avg: number }[]; company: number }) {
  const W = 580;
  const rowH = 38;
  const L = 190;
  const R = 56;
  const Tp = 28;
  const H = Tp + teams.length * rowH + 22;
  const aw = W - L - R;
  const x = (v: number) => L + aw * (v / 100);
  return (
    <Frame label="กราฟแท่งค่าเฉลี่ยรายทีมเทียบทั้งบริษัท">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={x(g)} x2={x(g)} y1={Tp - 6} y2={H - 22} stroke={AXIS} />
            <text x={x(g)} y={H - 6} textAnchor="middle" fontSize="12" className="fill-muted-foreground">
              {g}
            </text>
          </g>
        ))}
        {teams.map((t, i) => {
          const y = Tp + i * rowH;
          return (
            <g key={t.name}>
              <text x={L - 8} y={y + 19} textAnchor="end" fontSize="13" className="fill-foreground">
                {t.name.length > 24 ? `${t.name.slice(0, 23)}…` : t.name}
              </text>
              <text x={L - 8} y={y + 34} textAnchor="end" fontSize="12" className="fill-muted-foreground">
                {t.count} คน
              </text>
              <rect x={L} y={y + 6} width={Math.max(0, x(t.avg) - L)} height="22" rx="2" fill={t.avg >= company ? "#1976d2" : SOFT} />
              <text x={x(t.avg) + 6} y={y + 22} fontSize="14" fontWeight="700" className="fill-foreground">
                {fmt(t.avg)}%
              </text>
            </g>
          );
        })}
        <line x1={x(company)} x2={x(company)} y1={Tp - 8} y2={H - 22} className="stroke-foreground" strokeWidth="1.5" strokeDasharray="5 4" />
        <text x={x(company)} y={Tp - 12} textAnchor="middle" fontSize="12" className="fill-foreground">
          บริษัท {fmt(company)}%
        </text>
      </svg>
      <div className="mt-1 flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-0.5">
          <i className="inline-block size-3 rounded-[2px]" style={{ background: "#1976d2" }} aria-hidden="true" />
          เท่ากับหรือสูงกว่าบริษัท
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-0.5">
          <i className="inline-block size-3 rounded-[2px]" style={{ background: SOFT }} aria-hidden="true" />
          ต่ำกว่าบริษัท
        </span>
      </div>
    </Frame>
  );
}

export interface TrendSeries {
  name: string;
  values: (number | null)[];
  color: string;
  width: number;
  dash?: string;
}

/** Lines over the rounds. The value and the name sit at the end of each line, nudged apart so they do not overlap. */
export function TrendLines({ labels, series }: { labels: string[]; series: TrendSeries[] }) {
  const W = 800;
  const H = 300;
  const L = 40;
  const R = 230;
  const Tp = 14;
  const Bm = 30;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const lo = Math.max(0, Math.floor((Math.min(...all, 100) - 5) / 10) * 10);
  const hi = 100;
  const x = (i: number) => L + (W - L - R) * (labels.length <= 1 ? 0 : i / (labels.length - 1));
  const y = (v: number) => Tp + (H - Tp - Bm) * (1 - (v - lo) / (hi - lo));
  const grid: number[] = [];
  for (let g = lo; g <= hi; g += 10) grid.push(g);
  const ends = series
    .map((s) => {
      const last = s.values[s.values.length - 1];
      return last === null || last === undefined ? null : { y: y(last), name: s.name, v: last, color: s.color };
    })
    .filter((e): e is { y: number; name: string; v: number; color: string } => e !== null)
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i]!.y - ends[i - 1]!.y < 15) ends[i]!.y = ends[i - 1]!.y + 15;
  return (
    <Frame label="กราฟเส้นแนวโน้มคะแนนเฉลี่ยรายรอบ">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
        {grid.map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke={AXIS} />
            <text x={L - 6} y={y(g) + 4} textAnchor="end" fontSize="12" className="fill-muted-foreground">
              {g}
            </text>
          </g>
        ))}
        {labels.map((m, i) => (
          <text key={`${m}-${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="12" className="fill-muted-foreground">
            {m}
          </text>
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null ? null : ([x(i), y(v)] as const)));
          let d = "";
          for (const p of pts) if (p) d += `${d ? "L" : "M"}${p[0]} ${p[1]}`;
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash} strokeLinejoin="round" />
              {pts.map((p, i) => (p ? <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#fff" stroke={s.color} strokeWidth="2" /> : null))}
            </g>
          );
        })}
        {ends.map((e) => (
          <g key={e.name}>
            <text x={W - R + 10} y={e.y + 4} fontSize="13" fontWeight="700" fill={e.color}>
              {fmt(e.v)}%
            </text>
            <text x={W - R + 56} y={e.y + 4} fontSize="12" className="fill-muted-foreground">
              {e.name.length > 20 ? `${e.name.slice(0, 19)}…` : e.name}
            </text>
          </g>
        ))}
      </svg>
    </Frame>
  );
}

/** People whose score rose (right, blue) and fell (left, red) against their previous round, in points, with an arrow and the word. */
export function MoveBars({ rows }: { rows: { name: string; team: string; delta: number }[] }) {
  if (rows.length === 0) return <p className="text-muted-foreground py-6 text-center text-sm">ยังไม่มีคนที่ถูกประเมินมากกว่าหนึ่งรอบ จึงยังเทียบไม่ได้</p>;
  const W = 520;
  const rowH = 36;
  const mid = 300;
  const half = 160;
  const Tp = 8;
  const H = Tp + rows.length * rowH + 6;
  const m = Math.max(...rows.map((r) => Math.abs(r.delta)), 5);
  return (
    <Frame label="กราฟคนที่คะแนนขึ้นและลงมากที่สุดเทียบรอบก่อน">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
        {rows.map((r, i) => {
          const y = Tp + i * rowH;
          const w = (half * Math.abs(r.delta)) / m;
          const up = r.delta > 0;
          return (
            <g key={`${r.name}-${i}`}>
              <text x="4" y={y + 15} fontSize="13" className="fill-foreground">
                {r.name.length > 18 ? `${r.name.slice(0, 17)}…` : r.name}
              </text>
              <text x="4" y={y + 30} fontSize="12" className="fill-muted-foreground">
                {r.team.length > 20 ? `${r.team.slice(0, 19)}…` : r.team}
              </text>
              <rect x={up ? mid : mid - w} y={y + 6} width={w} height="20" rx="2" className={up ? "fill-primary" : "fill-destructive"} />
              <text x={up ? mid + w + 6 : mid - w - 6} y={y + 21} textAnchor={up ? "start" : "end"} fontSize="13" fontWeight="700" className={up ? "fill-status-normal-fg" : "fill-destructive"}>
                {up ? "▲ ขึ้น" : "▼ ลง"} {fmt(Math.abs(r.delta))}
              </text>
            </g>
          );
        })}
        <line x1={mid} x2={mid} y1="0" y2={H} stroke="#98a2b3" />
      </svg>
    </Frame>
  );
}
