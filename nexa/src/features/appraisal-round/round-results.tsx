"use client";

import { useState } from "react";
import Link from "next/link";
import { Calculator, Megaphone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { useResultActions, useRoundResults, useSettings } from "./hooks";
import { RESULT_STATUS_LABEL, type ResultStatus, type RoundStatus } from "./types";

const TONE: Record<ResultStatus, StatusTone> = { NOT_CALCULATED: "neutral", CALCULATED: "info", APPROVED: "primary", PUBLISHED: "success", ACKNOWLEDGED: "success" };

/** Scores of a round: calculate, approve (when the company asks for it) and publish. Everything follows the saved settings. */
export function RoundResults({ roundId, status }: { roundId: string; status: RoundStatus }) {
  const { can } = useAuth();
  const results = useRoundResults(roundId, true);
  const settings = useSettings();
  const act = useResultActions(roundId);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const rows = results.data?.data ?? [];
  const cfg = settings.data?.data;
  const needsApproval = (cfg?.approvalLevels ?? 0) >= 1;
  const counts = (s: ResultStatus) => rows.filter((r) => r.status === s).length;
  const canPublishNow = status === "CLOSED" && (needsApproval ? counts("APPROVED") : counts("CALCULATED")) > 0;

  async function run(kind: "calculate" | "approve" | "publish") {
    try {
      if (kind === "calculate") {
        const r = (await act.calculate.mutateAsync()).data;
        toast.success(`คำนวณแล้ว ${r.calculated} คน${r.noAnswers ? ` · ยังไม่มีคำตอบ ${r.noAnswers} คน` : ""}${r.kept ? ` · คงเดิม ${r.kept} คน (อนุมัติ/ประกาศแล้ว)` : ""}`);
      } else if (kind === "approve") {
        toast.success(`อนุมัติแล้ว ${(await act.approve.mutateAsync()).data.approved} คน`);
      } else {
        const r = (await act.publish.mutateAsync()).data;
        setConfirmPublish(false);
        toast.success(`ประกาศผลแล้ว ${r.published} คน${r.notified ? ` · แจ้งพนักงาน ${r.notified} คน` : ""}`);
      }
    } catch (err) {
      setConfirmPublish(false);
      toast.error(err instanceof ApiError ? err.message : "ทำรายการไม่สำเร็จ");
    }
  }

  if (results.isError) return <ErrorState onRetry={() => results.refetch()} />;
  if (results.isLoading) return <TableLoadingState rows={3} />;

  return (
    <Card className="gap-3 p-4" aria-label="ผลคะแนน">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">ผลคะแนน</h2>
        <Link href="/appraisal/settings" className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
          วิธีคิดคะแนนและเกณฑ์เกรด
        </Link>
      </div>
      {cfg && !cfg.configured && (
        <p className="rounded-xl bg-muted px-3 py-2 text-sm">ยังไม่ได้ตั้งค่าวิธีคิดคะแนน คำนวณได้ด้วยค่าเริ่มต้น (ถ่วงน้ำหนัก ไม่มีเกรด) ควรตั้งค่าก่อนประกาศผล</p>
      )}
      <p className="text-sm tabular-nums text-muted-foreground">
        ยังไม่คำนวณ {counts("NOT_CALCULATED")} · คำนวณแล้ว {counts("CALCULATED")} · อนุมัติแล้ว {counts("APPROVED")} · ประกาศแล้ว {counts("PUBLISHED") + counts("ACKNOWLEDGED")}
      </p>
      {can("campaign:update") && (
        <div className="flex flex-wrap gap-2">
          <Button className="h-11 md:h-9" onClick={() => run("calculate")} disabled={act.calculate.isPending}>
            <Calculator className="size-4" /> คำนวณผล
          </Button>
          {needsApproval && can("campaign:approve") && (
            <Button variant="outline" className="h-11 md:h-9" onClick={() => run("approve")} disabled={act.approve.isPending || counts("CALCULATED") === 0}>
              <ShieldCheck className="size-4" /> อนุมัติผลที่คำนวณแล้ว
            </Button>
          )}
          <Button variant="outline" className="h-11 md:h-9" onClick={() => setConfirmPublish(true)} disabled={!canPublishNow || act.publish.isPending}>
            <Megaphone className="size-4" /> ประกาศผล
          </Button>
        </div>
      )}
      {status !== "CLOSED" && <p className="text-xs text-muted-foreground">ประกาศผลได้เมื่อปิดรอบแล้ว (คำนวณดูระหว่างรอบได้)</p>}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">ชื่อ</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">คะแนน (%)</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">เกรด</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.participantId}>
                  <td className="px-3 py-2">
                    <Link href={`/appraisal/rounds/${roundId}/people/${r.participantId}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>{" "}
                    <span className="text-muted-foreground">{r.department}</span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.scorePercent ?? "-"}</td>
                  <td className="px-2 py-2">{r.grade ?? "-"}</td>
                  <td className="px-3 py-2">
                    <StatusChip tone={TONE[r.status]} label={RESULT_STATUS_LABEL[r.status]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title="ประกาศผล?"
        description={`จะประกาศผล ${needsApproval ? counts("APPROVED") : counts("CALCULATED")} คน${cfg?.employeeSees === "AFTER_PUBLISH" ? " และส่งข้อความแจ้งพนักงานแต่ละคน (ส่งแล้วเรียกคืนไม่ได้)" : " (พนักงานยังไม่เห็นผล ตามที่ตั้งค่า)"}`}
        confirmLabel="ประกาศผล"
        onConfirm={() => run("publish")}
        loading={act.publish.isPending}
      />
    </Card>
  );
}
