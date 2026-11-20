import Link from "next/link";
import { ChevronRight, TriangleAlert } from "lucide-react";

import { GvDraftIcon, GvEvaluationIcon, GvTimeIcon, GvIconTile } from "@/components/shared/gv-icons";
import { cn } from "@/lib/utils";
import { CopyTemplateButton } from "./copy-template-button";
import type { EvaluationOverview, RoundResultBoard } from "./evaluation-overview";
import { ScoreGauge } from "./score-gauge";

/** HR's evaluation panel on the home page: three number tiles, the score spread of the latest results, and the templates to copy. */

// Same glass look and rise on hover as the rest of the home page (see .gv-panel in globals.css).
const CARD = "gv-panel rounded-lg border border-border bg-card p-4  sm:p-5";
const LIFT = "gv-panel-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const fmtDay = (iso: string) => new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
/** Round names carry how they were made; on the home page only what the round is matters. */
const shortName = (name: string) => name.replace(/\s*\((?:นำเข้าจาก Favpo|รายชื่อจาก[^)]*)\)\s*$/, "");

function Tile({ href, icon, status, title, value, unit, note, action }: { href: string; icon: typeof GvEvaluationIcon; status?: "ok" | "warn"; title: string; value: number; unit: string; note: string; action: string }) {
  return (
    <Link href={href} className={cn(CARD, "block", LIFT)}>
      <span className="flex items-center gap-3">
        <GvIconTile icon={icon} status={status} />
        <span className="text-sm font-semibold">{title}</span>
      </span>
      <span className="mt-1 block text-4xl leading-tight font-bold tabular-nums">
        {value}
        <small className="ml-1 text-sm font-semibold text-muted-foreground">{unit}</small>
      </span>
      <span className="block text-sm text-muted-foreground">{note}</span>
      <span className="mt-2 flex min-h-10 items-center justify-between border-t border-border pt-2 text-sm font-bold text-primary">
        {action} <ChevronRight className="size-4" aria-hidden="true" />
      </span>
    </Link>
  );
}

/** Work waiting for HR, how long since the last round ended (or rounds open), and the templates ready to copy. */
export function HrEvalTiles({ o }: { o: EvaluationOverview }) {
  const work = o.awaitingReview.length + (o.awaitingCalculation ? 1 : 0) + o.draftCount;
  const openNow = o.open.filter((r) => !r.closed);
  const nearest = openNow.map((r) => r.daysLeft).filter((d): d is number => d !== null).sort((a, b) => a - b)[0];
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Tile
        href="/appraisal"
        icon={GvEvaluationIcon}
        status={work === 0 ? "ok" : "warn"}
        title="งานที่รอคุณ"
        value={work}
        unit="เรื่อง"
        note={work === 0 ? "ไม่มีรอบที่ต้องคำนวณ อนุมัติ หรือเปิด" : "คำนวณผล ทบทวน หรือเปิดรอบที่เตรียมไว้"}
        action="ดูหน้าประเมินผล"
      />
      {openNow.length > 0 ? (
        <Tile
          href={openNow[0]!.href}
          icon={GvTimeIcon}
          title="รอบที่เปิดอยู่"
          value={openNow.length}
          unit="รอบ"
          note={nearest === undefined ? "ยังไม่ได้กำหนดวันปิด" : nearest < 0 ? `เลยกำหนดปิด ${Math.abs(nearest)} วัน` : nearest === 0 ? "ปิดวันนี้" : `ใกล้ปิดสุดอีก ${nearest} วัน`}
          action="ดูความคืบหน้า"
        />
      ) : o.lastClosed ? (
        <Tile href="/appraisal/rounds" icon={GvTimeIcon} title="รอบล่าสุดปิดมา" value={o.lastClosed.daysAgo} unit="วัน" note={`ปิดเมื่อ ${fmtDay(o.lastClosed.endIso)} ตอนนี้ไม่มีรอบเปิด`} action="เปิดรอบใหม่" />
      ) : (
        <Tile href="/appraisal/rounds" icon={GvTimeIcon} title="รอบที่เปิดอยู่" value={0} unit="รอบ" note="ยังไม่เคยเปิดรอบประเมิน" action="สร้างรอบ" />
      )}
      <Tile href="/appraisal/rounds" icon={GvDraftIcon} title="แม่แบบพร้อมใช้" value={o.templates.length} unit="รอบ" note={o.templates.length > 0 ? "คัดลอกเพื่อเปิดรอบใหม่" : "ยังไม่มีแม่แบบ คัดลอกรอบเดิมเก็บไว้ใช้ได้"} action="ดูรอบทั้งหมด" />
    </div>
  );
}

/** Each score row opens the round's results with only the people in that band (?band=…), so the number can be checked against names. */
function SpreadBars({ b }: { b: RoundResultBoard }) {
  return (
    <ul className="mt-2 space-y-0.5 text-left">
      {b.spread.map((s) => (
        <li key={s.key}>
          <Link
            href={`${b.href}?band=${s.key}`}
            aria-label={`คะแนน ${s.label} ${s.count} คน ดูรายชื่อ`}
            className="gv-row group grid min-h-9 grid-cols-[4.2rem_1fr_3.4rem_1rem] items-center gap-2 rounded-lg px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span>{s.label}</span>
            <span className="h-3 overflow-hidden rounded-full bg-muted shadow-inner" aria-hidden="true">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${b.total > 0 ? Math.round((s.count / b.total) * 100) : 0}%` }} />
            </span>
            <span className="text-right text-muted-foreground tabular-nums">{s.count} คน</span>
            <ChevronRight className="size-4 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The latest approved results: the share at the top score as a gauge, and how the rest spread. No grade bands are assumed. */
export function ResultsBoardCard({ board }: { board: RoundResultBoard[] }) {
  if (board.length === 0) return null;
  const warn = board.some((b) => b.ceiling);
  return (
    <article className={CARD} aria-label="ผลรอบล่าสุด">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base leading-snug font-semibold">ผลรอบล่าสุด</h3>
        {warn && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-status-late-border bg-status-late-bg px-2.5 py-0.5 text-xs font-semibold text-status-late-fg">
            <TriangleAlert className="size-3.5" aria-hidden="true" /> คะแนนกระจุกที่เต็ม
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">มาตรวัดคือสัดส่วนคนที่ได้เต็ม 100%{warn ? " ตั้งแต่ครึ่งหนึ่งขึ้นไป แยกคนที่ทำได้ดีกว่ากันด้วยคะแนนไม่ได้" : ""}</p>
      <div className={cn("mt-2 grid gap-4", board.length > 1 && "sm:grid-cols-2")}>
        {board.map((b) => (
          <section key={b.roundId} aria-label={shortName(b.roundName)} className="text-center">
            <Link href={b.href} aria-label={`ดูผลทั้งรอบ ${shortName(b.roundName)}`} className={cn("block rounded-lg p-2", LIFT, "hover:bg-primary/5")}>
              <span className="block text-sm font-semibold break-words">{shortName(b.roundName)}</span>
              <span className="block text-sm text-muted-foreground tabular-nums">
                {b.atTop} จาก {b.total} คน
              </span>
              <ScoreGauge percent={b.total > 0 ? Math.round((b.atTop / b.total) * 100) : 0} caption="ได้เต็ม 100%" />
              <span className="flex items-center justify-center gap-1 text-sm font-bold text-primary">
                ดูผลทั้งรอบ <ChevronRight className="size-4" aria-hidden="true" />
              </span>
            </Link>
            <SpreadBars b={b} />
          </section>
        ))}
      </div>
      <Link href={board[0]!.href} className="mt-3 flex min-h-10 items-center justify-between border-t border-border pt-2 text-sm font-bold text-primary">
        ดูผลและรายงานเต็ม <ChevronRight className="size-4" aria-hidden="true" />
      </Link>
    </article>
  );
}

const STEPS = ["เลือกแม่แบบ", "ตั้งวันเปิด-ปิด", "เปิดรอบ"];

/** Opening this month's round: copy a template, set the dates, open. */
export function TemplateCard({ templates }: { templates: EvaluationOverview["templates"] }) {
  return (
    <article className={CARD} aria-label="เปิดรอบเดือนนี้">
      <h3 className="text-base leading-snug font-semibold">เปิดรอบเดือนนี้</h3>
      {templates.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">ใช้แม่แบบที่มีรายชื่อ “ใครประเมินใคร” พร้อมแล้ว</p>
          <ol className="my-3 flex flex-wrap gap-2">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-2 rounded-full border border-border bg-muted/50 py-0.5 pr-3 pl-1 text-sm font-semibold">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <div className="grid gap-2">
            {templates.map((t) => (
              <CopyTemplateButton key={t.id} id={t.id} label={shortName(t.name)} />
            ))}
          </div>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">ยังไม่มีแม่แบบ เปิดรอบแรกแล้วกดคัดลอกที่หน้ารอบประเมิน หรือตั้งให้ระบบสร้างรอบทุกเดือน</p>
      )}
      <Link href="/appraisal/recurring" className="mt-3 flex min-h-10 items-center justify-between border-t border-border pt-2 text-sm font-bold text-primary">
        ตั้งให้ระบบสร้างรอบทุกเดือน <ChevronRight className="size-4" aria-hidden="true" />
      </Link>
    </article>
  );
}
