import { cn } from "@/lib/utils";
import type { EmployeeStatus } from "./types";
import { STATUS_LABEL } from "./labels";

const STATUS_STYLE: Record<EmployeeStatus, string> = {
  ACTIVE: "bg-success/10 text-success",
  ON_LEAVE: "bg-warning/10 text-warning",
  SUSPENDED: "bg-muted text-muted-foreground",
  TERMINATED: "bg-destructive/10 text-destructive",
  RESIGNED: "bg-muted text-muted-foreground",
};

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_STYLE[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}
