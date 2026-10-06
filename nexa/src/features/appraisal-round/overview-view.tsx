"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { StatusChip } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDepartmentProgress, useRounds } from "./hooks";
import type { RoundListItem } from "./types";

const fmt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)) : "-";

function OpenRoundCard({ round }: { round: RoundListItem }) {
  const dept = useDepartmentProgress(round.id, true);
  const pct = round.total > 0 ? Math.round((round.submitted / round.total) * 100) : 0;
  const rows = dept.data?.data ?? [];
  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold break-words">{round.name}</h2>
          <p className="text-sm text-muted-foreground">
            {round.participantCount} คน · {fmt(round.startIso)} – {fmt(round.endIso)}
          </p>
        </div>
        <StatusChip tone="success" label="เปิดอยู่" />
      </div>
      <p className="text-sm tabular-nums">
        ส่งแล้ว <b>{round.submitted}</b> จาก <b>{round.total}</b> งาน ({pct}%)
      </p>
      <div role="progressbar" aria-label={`ความคืบหน้า ${round.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-[var(--flip7-teal-dark)]" style={{ width: `${pct}%` }} />
      </div>
      {rows.length > 0 && (
        <ul className="space-y-2" aria-label="ความคืบหน้ารายแผนก">
          {rows.map((d) => (
            <li key={d.department} className="space-y-1">
              <div className="flex justify-between gap-2 text-sm">
                <span className="break-words">{d.department}</span>
                <span className="text-muted-foreground tabular-nums">
                  {d.submitted}/{d.total} ({d.percent}%)
                </span>
              </div>
              <div role="progressbar" aria-label={d.department} aria-valuemin={0} aria-valuemax={100} aria-valuenow={d.percent} className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-[var(--flip7-teal-dark)]" style={{ width: `${d.percent}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button className="h-11 md:h-9" render={<Link href={`/appraisal/rounds/${round.id}`} />}>
          ดูรอบนี้และคนที่ยังไม่ประเมิน
        </Button>
      </div>
    </Card>
  );
}

/** Home of the evaluation menu: every open round with its progress by department, plus ways in to forms and rounds. */
export function OverviewView() {
  const { data, isLoading, isError, refetch } = useRounds();
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={3} />;
  const rounds = data?.data ?? [];
  const open = rounds.filter((r) => r.status === "OPEN");
  const scheduled = rounds.filter((r) => r.status === "SCHEDULED");
  const drafts = rounds.filter((r) => r.status === "DRAFT");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button className="h-11 md:h-9" render={<Link href="/appraisal/rounds" />}>
          รอบประเมินทั้งหมด
        </Button>
        <Button variant="outline" className="h-11 md:h-9" render={<Link href="/appraisal/forms" />}>
          แบบประเมิน
        </Button>
      </div>
      {open.length === 0 ? (
        <EmptyState icon={ClipboardList} title="ตอนนี้ไม่มีรอบที่เปิดอยู่" description="สร้างรอบใหม่ได้ที่หน้า “รอบประเมินทั้งหมด”" />
      ) : (
        open.map((r) => <OpenRoundCard key={r.id} round={r} />)
      )}
      {(scheduled.length > 0 || drafts.length > 0) && (
        <p className="text-sm text-muted-foreground">
          {scheduled.length > 0 && `ตั้งเวลาไว้ ${scheduled.length} รอบ`}
          {scheduled.length > 0 && drafts.length > 0 && " · "}
          {drafts.length > 0 && `ฉบับร่าง ${drafts.length} รอบ`}
        </p>
      )}
    </div>
  );
}
