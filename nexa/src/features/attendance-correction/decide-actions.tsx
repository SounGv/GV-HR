"use client";

import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useDecideAttendanceCorrection } from "./hooks";

/**
 * Approve/reject buttons for the attendance-correction detail page
 * (/attendance/corrections/[id]) — the page a manager lands on from the
 * "มีคำขอแก้ไขเวลาเข้า-ออกงานรออนุมัติ" notification link. The list view's
 * own Approvals tab already has these, but that notification bypasses the
 * list entirely, and the detail page itself used to be read-only: a
 * manager tapping the notification had no way to act from there. Visibility
 * (only render when this session can actually decide it) is computed
 * server-side by the page and passed down as `show`.
 */
export function AttendanceCorrectionDecideActions({ id, show }: { id: string; show: boolean }) {
  const router = useRouter();
  const decideMut = useDecideAttendanceCorrection();

  if (!show) return null;

  async function decide(action: "approve" | "reject") {
    try {
      await decideMut.mutateAsync({ id, action });
      toast.success(action === "approve" ? "อนุมัติเรียบร้อย" : "ปฏิเสธคำขอเรียบร้อย");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" disabled={decideMut.isPending} onClick={() => decide("reject")}>
        <X className="size-4" /> ปฏิเสธ
      </Button>
      <Button size="sm" disabled={decideMut.isPending} onClick={() => decide("approve")}>
        <Check className="size-4" /> อนุมัติ
      </Button>
    </div>
  );
}
