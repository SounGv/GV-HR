"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { DAY_OFF_MULTIPLIER, DEFAULT_MULTIPLIER } from "./calc";
import { useDecideOvertime } from "./hooks";

/**
 * Approve/reject buttons for the OT detail page (/overtime/[id]) — the page
 * a manager lands on from the "มีคำขอ OT รออนุมัติ" notification link. The
 * list view's own Approvals tab already has these, but that notification
 * bypasses the list entirely, and the detail page itself used to be
 * read-only: a manager tapping the notification had no way to act from
 * there and had to know to go find the request in the list instead.
 * Visibility (only render when this session can actually decide it) is
 * computed server-side by the page and passed down as `show`.
 *
 * The system sets the kind of day from the date when the request is sent, but
 * it cannot know an off Saturday, so the approver can switch it here before
 * approving; the pay is worked out at approval from the type shown.
 */
export function OvertimeDecideActions({
  id,
  show,
  currentMultiplier,
}: {
  id: string;
  show: boolean;
  /** The rate the request carries now (set by the system when it was sent). */
  currentMultiplier: number;
}) {
  const router = useRouter();
  const decideMut = useDecideOvertime();
  const [dayType, setDayType] = useState<"NORMAL" | "DAY_OFF">(currentMultiplier >= DAY_OFF_MULTIPLIER ? "DAY_OFF" : "NORMAL");

  if (!show) return null;

  async function decide(action: "approve" | "reject") {
    try {
      await decideMut.mutateAsync({ id, action, dayType: action === "approve" ? dayType : undefined });
      toast.success(action === "approve" ? "อนุมัติเรียบร้อย" : "ปฏิเสธคำขอเรียบร้อย");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label="ประเภทวัน" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(
          [
            ["NORMAL", "วันทำงาน", DEFAULT_MULTIPLIER],
            ["DAY_OFF", "วันหยุด", DAY_OFF_MULTIPLIER],
          ] as const
        ).map(([value, title, times]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={dayType === value}
            onClick={() => setDayType(value)}
            className={cn(
              "min-h-8 rounded-md px-2.5 text-xs font-semibold transition",
              dayType === value ? "bg-card text-primary shadow-sm" : "text-muted-foreground",
            )}
          >
            {title} <span className="tabular-nums">×{times}</span>
          </button>
        ))}
      </div>
      <Button variant="outline" size="sm" disabled={decideMut.isPending} onClick={() => decide("reject")}>
        <X className="size-4" /> ปฏิเสธ
      </Button>
      <Button size="sm" disabled={decideMut.isPending} onClick={() => decide("approve")}>
        <Check className="size-4" /> อนุมัติ
      </Button>
    </div>
  );
}
