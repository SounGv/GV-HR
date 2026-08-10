"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ApiError } from "@/lib/api/client";
import { useUpdateCampaign } from "./hooks";
import type { CampaignStatus } from "./types";

/**
 * There was previously no way to move a campaign out of DRAFT at all — every
 * campaign created (manually or by the recurring schedule generator) stayed
 * DRAFT forever, so raters never saw it in their pending-tasks list (which
 * only surfaces ACTIVE campaigns — see getMyPendingResponses). This is the
 * missing "turn it on" / "close it out" control.
 */
export function CampaignStatusActions({
  campaignId,
  status,
  participantCount,
}: {
  campaignId: string;
  status: CampaignStatus;
  participantCount: number;
}) {
  const router = useRouter();
  const updateMutation = useUpdateCampaign(campaignId);
  const [closeOpen, setCloseOpen] = useState(false);

  async function activate() {
    if (participantCount === 0) {
      toast.error("กรุณาเพิ่มผู้เข้าร่วมก่อนเปิดใช้งานแคมเปญ");
      return;
    }
    try {
      await updateMutation.mutateAsync({ status: "ACTIVE" });
      toast.success("เปิดใช้งานแคมเปญแล้ว — ผู้ประเมินจะเห็นงานที่ต้องทำทันที");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เปิดใช้งานไม่สำเร็จ");
    }
  }

  async function close() {
    try {
      await updateMutation.mutateAsync({ status: "CLOSED" });
      toast.success("ปิดแคมเปญแล้ว");
      setCloseOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ปิดแคมเปญไม่สำเร็จ");
    }
  }

  if (status === "DRAFT") {
    return (
      <Button size="sm" onClick={activate} disabled={updateMutation.isPending}>
        {updateMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
        เปิดใช้งานแคมเปญ
      </Button>
    );
  }

  if (status === "ACTIVE") {
    return (
      <>
        <Button size="sm" variant="outline" onClick={() => setCloseOpen(true)}>
          <Lock className="size-4" /> ปิดแคมเปญ
        </Button>
        <ConfirmDialog
          open={closeOpen}
          onOpenChange={setCloseOpen}
          title="ปิดแคมเปญนี้?"
          description="ผู้ประเมินที่ยังไม่ส่งแบบประเมินจะไม่สามารถส่งได้อีก และงานนี้จะหายไปจากรายการที่ต้องทำของทุกคน"
          confirmLabel="ปิดแคมเปญ"
          destructive
          loading={updateMutation.isPending}
          onConfirm={close}
        />
      </>
    );
  }

  return null;
}
