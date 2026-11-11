"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { useCloseRound, useRemindRound, useRound, useRoundProgress, useUnscheduleRound } from "./hooks";
import { RoundMatrix } from "./round-tracking";
import { RoundResults } from "./round-results";
import { Wizard } from "./wizard";
import { ROUND_STATUS_LABEL, type RoundDetail, type RoundStatus } from "./types";

const TONE: Record<RoundStatus, StatusTone> = { DRAFT: "warning", SCHEDULED: "info", OPEN: "success", CLOSED: "neutral" };

const fmtDay = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)) : "-";

/** Loads one round; a draft opens in the 4-step wizard (wizard.tsx), anything else shows progress. */
export function RoundPage({ id }: { id: string }) {
  const { data, isLoading, isError, refetch } = useRound(id);
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !data) return <TableLoadingState rows={4} />;
  const round = data.data;
  return round.status === "DRAFT" ? <Wizard key={round.id} round={round} /> : <RoundOverview round={round} />;
}

function Header({ round, backTitle }: { round: RoundDetail; backTitle?: string }) {
  return (
    <PageHeaderBar
      breadcrumbs={[{ label: "ประเมิน", href: "/appraisal/rounds" }, { label: "รอบประเมิน", href: "/appraisal/rounds" }, { label: round.name }]}
      backHref="/appraisal/rounds"
      title={backTitle ?? round.name}
      status={<StatusChip tone={TONE[round.status]} label={ROUND_STATUS_LABEL[round.status]} />}
      sticky={false}
    />
  );
}

/* ───────────────────────── overview (opened rounds) ───────────────────────── */

function RoundOverview({ round }: { round: RoundDetail }) {
  const { can } = useAuth();
  const live = round.status === "OPEN" || round.status === "CLOSED";
  const progress = useRoundProgress(round.id, live);
  const remind = useRemindRound(round.id);
  const close = useCloseRound(round.id);
  const unschedule = useUnscheduleRound(round.id);
  const [confirmClose, setConfirmClose] = useState(false);
  const p = progress.data?.data;
  const pct = p && p.total > 0 ? Math.round((p.submitted / p.total) * 100) : 0;

  async function doRemind() {
    try {
      const res = await remind.mutateAsync();
      toast.success(res.data.reminded > 0 ? `เตือน ${res.data.reminded} คนแล้ว` : "ไม่มีใครต้องเตือนในตอนนี้");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เตือนไม่สำเร็จ");
    }
  }

  async function doUnschedule() {
    try {
      await unschedule.mutateAsync();
      toast.success("กลับเป็นฉบับร่างแล้ว แก้ไขได้");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ทำรายการไม่สำเร็จ");
    }
  }

  async function doClose() {
    try {
      await close.mutateAsync();
      toast.success("ปิดรอบแล้ว");
      setConfirmClose(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ปิดรอบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <Header round={round} />
      <Card className="gap-3 p-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">แบบที่ใช้</dt>
            <dd className="font-medium break-words">{round.formsUsed.map((f) => f.name).join(" · ") || round.formName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">ช่วงรอบ</dt>
            <dd className="font-medium">
              {fmtDay(round.startIso)} – {fmtDay(round.endIso)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">คนที่ถูกประเมิน</dt>
            <dd className="font-medium tabular-nums">{round.participantIds.length} คน</dd>
          </div>
        </dl>
        {round.status === "SCHEDULED" && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted px-3 py-2 text-sm">
            <p className="min-w-0 flex-1">ตั้งเวลาไว้แล้ว ระบบจะส่งข้อความหาผู้ประเมินในวันที่ {fmtDay(round.startIso)}</p>
            {can("campaign:update") && (
              <Button variant="outline" className="h-11 md:h-9" disabled={unschedule.isPending} onClick={doUnschedule}>
                ยกเลิกการตั้งเวลา (กลับไปแก้ไข)
              </Button>
            )}
          </div>
        )}
      </Card>

      {live && (
        <Card className="gap-3 p-4" aria-label="ความคืบหน้า">
          <h2 className="text-base font-semibold">ความคืบหน้า</h2>
          {!p ? (
            <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
          ) : (
            <>
              <p className="text-sm tabular-nums">
                ส่งแล้ว <b>{p.submitted}</b> จาก <b>{p.total}</b> งาน ({pct}%) · กำลังทำ {p.inProgress} · ยังไม่เริ่ม {p.pending}
              </p>
              <div role="progressbar" aria-label="ส่งแล้ว" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-[var(--flip7-teal-dark)]" style={{ width: `${pct}%` }} />
              </div>
            </>
          )}
          {round.status === "OPEN" && can("campaign:update") && (
            <div className="flex flex-wrap gap-2">
              <Button className="h-11 md:h-9" onClick={doRemind} disabled={remind.isPending}>
                <Bell className="size-4" /> เตือนทุกคนที่ยังไม่ส่ง
              </Button>
              <Button variant="outline" className="h-11 md:h-9" onClick={() => setConfirmClose(true)}>
                ปิดรอบ
              </Button>
            </div>
          )}
        </Card>
      )}

      {live && <RoundMatrix roundId={round.id} canFill={round.status === "OPEN" && can("campaign:update")} />}
      {live && <RoundResults roundId={round.id} status={round.status} />}

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="ปิดรอบนี้?"
        description="ปิดแล้วผู้ประเมินส่งผลเพิ่มไม่ได้"
        confirmLabel="ปิดรอบ"
        destructive
        onConfirm={doClose}
        loading={close.isPending}
      />
    </div>
  );
}
