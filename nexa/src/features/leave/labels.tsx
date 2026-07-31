import { cn } from "@/lib/utils";
import type { LeaveStatus, LeaveType } from "./types";

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  ANNUAL: "ลาพักร้อน",
  SICK: "ลาป่วย",
  PERSONAL: "ลากิจ",
  UNPAID: "ลาไม่รับค่าจ้าง",
  OTHER: "อื่น ๆ",
};

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
  CANCELLED: "ยกเลิก",
};

const STATUS_STYLE: Record<LeaveStatus, string> = {
  PENDING: "bg-warning/10 text-warning",
  APPROVED: "bg-success/10 text-success",
  REJECTED: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_STYLE[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {LEAVE_STATUS_LABEL[status]}
    </span>
  );
}
