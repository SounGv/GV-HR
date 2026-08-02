import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import type { EmployeeStatus } from "./types";
import { STATUS_LABEL } from "./labels";

const STATUS_TONE: Record<EmployeeStatus, StatusTone> = {
  ACTIVE: "success",
  ON_LEAVE: "warning",
  SUSPENDED: "neutral",
  TERMINATED: "danger",
  RESIGNED: "neutral",
};

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  return <StatusChip tone={STATUS_TONE[status]} label={STATUS_LABEL[status]} />;
}
