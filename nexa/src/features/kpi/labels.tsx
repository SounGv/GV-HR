import { cn } from "@/lib/utils";
import type { GoalStatus, GoalType } from "./types";

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  NOT_STARTED: "ยังไม่เริ่ม",
  IN_PROGRESS: "กำลังดำเนินการ",
  AT_RISK: "เสี่ยงไม่สำเร็จ",
  COMPLETED: "สำเร็จแล้ว",
  CANCELLED: "ยกเลิก",
};

export const GOAL_TYPE_LABEL: Record<GoalType, string> = {
  KPI: "KPI",
  OKR: "OKR",
};

const STATUS_STYLE: Record<GoalStatus, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-primary/10 text-primary",
  AT_RISK: "bg-warning/10 text-warning",
  COMPLETED: "bg-success/10 text-success",
  CANCELLED: "bg-destructive/10 text-destructive",
};

export function GoalStatusBadge({ status }: { status: GoalStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_STYLE[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {GOAL_STATUS_LABEL[status]}
    </span>
  );
}
