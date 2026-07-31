import { cn } from "@/lib/utils";
import type { RequestStatus, StepStatus } from "./types";

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
  CANCELLED: "ยกเลิก",
};

const STATUS_STYLE: Record<RequestStatus, string> = {
  PENDING: "bg-warning/10 text-warning",
  APPROVED: "bg-success/10 text-success",
  REJECTED: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_STYLE[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {REQUEST_STATUS_LABEL[status]}
    </span>
  );
}

export const STEP_DOT: Record<StepStatus, string> = {
  PENDING: "bg-muted-foreground/40",
  APPROVED: "bg-success",
  REJECTED: "bg-destructive",
};
