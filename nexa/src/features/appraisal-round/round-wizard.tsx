"use client";

import { useState } from "react";
import Link from "next/link";
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
import { useCloseRound, useRemindRound, useRound, useRoundProgress, useRoundResults, useUnscheduleRound } from "./hooks";
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

/** The Favpo hub: a box of plain link rows under a small heading (approved layout, Favpo round setting page). */
function HubBox({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-border rounded-sm border border-border">{children}</div>;
}

const HUB_ROW = "flex min-h-11 w-full items-center px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-[#f6f9fe] hover:text-primary disabled:opacity-50";

function HubLink({ href, next, children }: { href: string; next?: boolean; children: React.ReactNode }) {
  return next ? (
    <Link href={href} className={HUB_ROW}>
      {children}
    </Link>
  ) : (
    <a href={href} className={HUB_ROW}>
      {children}
    </a>
  );
}

function HubButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={HUB_ROW}>
      {children}
    </button>
  );
}

function RoundOverview({ round }: { round: RoundDetail }) {
  const { can } = useAuth();
  const live = round.status === "OPEN" || round.status === "CLOSED";
  const progress = useRoundProgress(round.id, live);
  // Rounds brought in from Favpo have scores but no tasks: say so instead of "0 of 0 (0%)".
  const results = useRoundResults(round.id, live);
  const imported = (results.data?.data.length ?? 0) > 0 && results.data!.data.every((r) => r.imported);
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
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
            <p className="min-w-0 flex-1">ตั้งเวลาไว้แล้ว ระบบจะส่งข้อความหาผู้ประเมินในวันที่ {fmtDay(round.startIso)}</p>
            {can("campaign:update") && (
              <Button variant="outline" className="h-11 md:h-9" disabled={unschedule.isPending} onClick={doUnschedule}>
                ยกเลิกการตั้งเวลา (กลับไปแก้ไข)
              </Button>
            )}
          </div>
        )}
      </Card>

      {live && !imported && (
        <section aria-label="ศูนย์รวมของรอบนี้" className="grid gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-3">
          <div>
            <h2 className="mb-2 text-base font-medium">ผู้ประเมิน</h2>
            <HubBox>
              <HubLink href="#check">ตรวจเช็คการประเมิน (เรียงตามผู้ประเมิน)</HubLink>
              <HubLink href="#check">
                ผู้ประเมินที่ยังไม่ส่ง{p ? ` (${p.inProgress + p.pending} งาน)` : ""}
              </HubLink>
            </HubBox>
          </div>
          <div>
            <h2 className="mb-2 text-base font-medium">ผลคะแนน</h2>
            <HubBox>
              <HubLink href="#results">ผลคะแนนและเกณฑ์เกรด</HubLink>
              {can("campaign:update") && (
                <HubLink href={`/appraisal/rounds/${round.id}/review`} next>
                  ทบทวนผลก่อนประกาศ
                </HubLink>
              )}
            </HubBox>
          </div>
          <div>
            <h2 className="mb-2 text-base font-medium">แจ้งเตือนและปิดรอบ</h2>
            <HubBox>
              {round.status === "OPEN" && can("campaign:update") ? (
                <>
                  <HubButton onClick={doRemind} disabled={remind.isPending}>
                    เตือนทุกคนที่ยังไม่ส่ง
                  </HubButton>
                  <HubButton onClick={() => setConfirmClose(true)}>ปิดรอบ</HubButton>
                </>
              ) : (
                <p className="px-3 py-2 text-sm text-muted-foreground">รอบนี้ปิดแล้ว ไม่มีการเตือนหรือปิดรอบเพิ่ม</p>
              )}
            </HubBox>
          </div>
        </section>
      )}

      {live && (
        <Card className="gap-3 p-4" aria-label="ความคืบหน้า">
          <h2 className="text-base font-semibold">ความคืบหน้า</h2>
          {imported ? (
            <p className="text-sm text-muted-foreground">
              นำเข้าจาก Favpo: มีเฉพาะคะแนนรวมของแต่ละคน ไม่มีงานประเมินรายข้อในระบบนี้ จึงไม่มีความคืบหน้าให้ติดตาม
            </p>
          ) : !p ? (
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
