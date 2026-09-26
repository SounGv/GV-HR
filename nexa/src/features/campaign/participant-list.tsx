"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { fullName } from "@/lib/format";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/features/auth/auth-context";
import { useFinalizeParticipant, useRejectParticipantResult } from "./hooks";
import type { ParticipantSummary, RaterType } from "./types";

function RaterStatus({ label, status }: { label: string; status: "SUBMITTED" | "PENDING" }) {
  return (
    <span className="flex items-center gap-1 text-xs">
      {status === "SUBMITTED" ? (
        <CheckCircle2 className="size-3.5 text-success" />
      ) : (
        <Circle className="size-3.5 text-muted-foreground" />
      )}
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

export function ParticipantList({
  campaignId,
  participants,
  raterTypes,
}: {
  campaignId: string;
  participants: ParticipantSummary[];
  raterTypes: RaterType[];
}) {
  const router = useRouter();
  const { can } = useAuth();
  const canFinalize = can("campaign:approve");
  const finalizeMutation = useFinalizeParticipant();
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  async function finalize(participantId: string) {
    try {
      await finalizeMutation.mutateAsync(participantId);
      toast.success("สรุปผลเรียบร้อย");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "สรุปผลไม่สำเร็จ");
    }
  }

  if (participants.length === 0) {
    return <p className="text-sm text-muted-foreground">ยังไม่มีผู้เข้าร่วมในแคมเปญนี้</p>;
  }

  return (
    <Card className="divide-y divide-border p-0">
      {participants.map((p) => {
        const selfDone = p.responses.some((r) => r.raterType === "SELF" && r.status === "SUBMITTED");
        const managerResponse = p.responses.find((r) => r.raterType === "MANAGER");
        const managerStatus = managerResponse?.status === "SUBMITTED" ? "SUBMITTED" : "PENDING";
        const peerResponses = p.responses.filter((r) => r.raterType === "PEER");
        const upwardResponses = p.responses.filter((r) => r.raterType === "UPWARD");
        const hrExecResponses = p.responses.filter((r) => r.raterType === "HR_EXEC");

        return (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href={`/performance/campaigns/${campaignId}/participants/${p.id}`} className="min-w-0 flex-1">
              <div className="font-medium text-foreground">{fullName(p.employee.firstName, p.employee.lastName)}</div>
              <div className="mt-0.5 flex items-center gap-3">
                {raterTypes.includes("SELF") && (
                  <RaterStatus label="ตนเอง" status={selfDone ? "SUBMITTED" : "PENDING"} />
                )}
                {raterTypes.includes("MANAGER") && <RaterStatus label="หัวหน้างาน" status={managerStatus} />}
                {peerResponses.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    เพื่อนร่วมงาน {peerResponses.filter((r) => r.status === "SUBMITTED").length}/{peerResponses.length}
                  </span>
                )}
                {upwardResponses.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ผู้ใต้บังคับบัญชา {upwardResponses.filter((r) => r.status === "SUBMITTED").length}/{upwardResponses.length}
                  </span>
                )}
                {hrExecResponses.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    HR/ผู้บริหาร {hrExecResponses.filter((r) => r.status === "SUBMITTED").length}/{hrExecResponses.length}
                  </span>
                )}
              </div>
            </Link>
            <div className="flex shrink-0 items-center gap-3">
              {p.overallScore != null && (
                <div className="text-right">
                  <div className="text-sm font-semibold text-foreground">{p.overallScore.toFixed(1)}</div>
                  <div className="text-[10px] text-muted-foreground">{p.band}</div>
                </div>
              )}
              {p.finalizedAt ? (
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                  สรุปผลแล้ว
                </span>
              ) : (
                canFinalize &&
                p.overallScore != null && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={finalizeMutation.isPending}
                      onClick={() => setRejectTarget(p.id)}
                    >
                      <XCircle className="size-3.5" /> ไม่อนุมัติ
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={finalizeMutation.isPending}
                      onClick={() => finalize(p.id)}
                    >
                      {finalizeMutation.isPending && <Loader2 className="size-3.5 animate-spin" />} สรุปผล
                    </Button>
                  </div>
                )
              )}
            </div>
          </div>
        );
      })}
      <RejectResultDialog participantId={rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)} />
    </Card>
  );
}

/** "ไม่อนุมัติ" — sends the scoring rater's response back for revision with
 * a required reason (see rejectParticipantResult). */
function RejectResultDialog({
  participantId,
  onOpenChange,
}: {
  participantId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const rejectMutation = useRejectParticipantResult();

  async function submit() {
    if (!participantId) return;
    if (!note.trim()) {
      toast.error("กรุณาระบุเหตุผลที่ไม่อนุมัติ");
      return;
    }
    try {
      await rejectMutation.mutateAsync({ participantId, note: note.trim() });
      toast.success("ส่งกลับให้แก้ไขแล้ว");
      setNote("");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={!!participantId} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>ไม่อนุมัติผลการประเมิน</DialogTitle>
          <DialogDescription>ส่งคำตอบของผู้ประเมินหลักกลับไปแก้ไข ต้องระบุเหตุผล</DialogDescription>
        </DialogHeader>
        <Textarea
          rows={3}
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="เช่น คะแนนไม่สอดคล้องกับพฤติกรรมที่ระบุ กรุณาทบทวนใหม่"
        />
        <Button className="w-full" onClick={submit} disabled={rejectMutation.isPending}>
          {rejectMutation.isPending && <Loader2 className="size-4 animate-spin" />} ยืนยันไม่อนุมัติ
        </Button>
      </DialogContent>
    </Dialog>
  );
}
