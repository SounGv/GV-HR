"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fullName } from "@/lib/format";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/features/auth/auth-context";
import { useFinalizeParticipant } from "./hooks";
import type { ParticipantSummary } from "./types";

function RaterStatus({ label, status }: { label: string; status: "SUBMITTED" | "PENDING" | "NONE" }) {
  return (
    <span className="flex items-center gap-1 text-xs">
      {status === "SUBMITTED" ? (
        <CheckCircle2 className="size-3.5 text-success" />
      ) : (
        <Circle className="size-3.5 text-muted-foreground" />
      )}
      <span className={status === "NONE" ? "text-muted-foreground/60 line-through" : "text-muted-foreground"}>
        {label}
      </span>
    </span>
  );
}

export function ParticipantList({ campaignId, participants }: { campaignId: string; participants: ParticipantSummary[] }) {
  const router = useRouter();
  const { can } = useAuth();
  const canFinalize = can("campaign:approve");
  const finalizeMutation = useFinalizeParticipant();

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
        const managerStatus = !managerResponse ? "NONE" : managerResponse.status === "SUBMITTED" ? "SUBMITTED" : "PENDING";

        return (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href={`/performance/campaigns/${campaignId}/participants/${p.id}`} className="min-w-0 flex-1">
              <div className="font-medium text-foreground">{fullName(p.employee.firstName, p.employee.lastName)}</div>
              <div className="mt-0.5 flex items-center gap-3">
                <RaterStatus label="ตนเอง" status={selfDone ? "SUBMITTED" : "PENDING"} />
                <RaterStatus label="หัวหน้างาน" status={managerStatus} />
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
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={finalizeMutation.isPending}
                    onClick={() => finalize(p.id)}
                  >
                    {finalizeMutation.isPending && <Loader2 className="size-3.5 animate-spin" />} สรุปผล
                  </Button>
                )
              )}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
