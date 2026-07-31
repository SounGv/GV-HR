import { cn } from "@/lib/utils";
import type { EnrollmentStatus } from "./types";

export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  ENROLLED: "ลงทะเบียนแล้ว",
  COMPLETED: "เรียนจบ",
  CANCELLED: "ยกเลิก",
};

const STYLE: Record<EnrollmentStatus, string> = {
  ENROLLED: "bg-primary/10 text-primary",
  COMPLETED: "bg-success/10 text-success",
  CANCELLED: "bg-muted text-muted-foreground",
};

export function EnrollmentStatusBadge({ status }: { status: EnrollmentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        STYLE[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {ENROLLMENT_STATUS_LABEL[status]}
    </span>
  );
}
