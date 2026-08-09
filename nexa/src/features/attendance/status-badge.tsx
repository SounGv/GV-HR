import { cn } from "@/lib/utils";
import type { AttendanceStatus, AttendanceWorkMode } from "./types";

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "มาทำงาน",
  LATE: "มาสาย",
  ABSENT: "ขาดงาน",
  ON_LEAVE: "ลางาน",
};

export const WORK_MODE_LABEL: Record<AttendanceWorkMode, string> = {
  ONSITE: "สำนักงาน",
  WFH: "WFH",
  OUTSIDE: "นอกสถานที่",
};

const STYLE: Record<AttendanceStatus, string> = {
  PRESENT: "bg-success/10 text-success",
  LATE: "bg-warning/10 text-warning",
  ABSENT: "bg-destructive/10 text-destructive",
  ON_LEAVE: "bg-info/10 text-info",
};

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        STYLE[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {ATTENDANCE_STATUS_LABEL[status]}
    </span>
  );
}
