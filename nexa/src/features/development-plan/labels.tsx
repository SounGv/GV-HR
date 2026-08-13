import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import type { DevelopmentItemStatus } from "./types";

export const ITEM_STATUS_LABEL: Record<DevelopmentItemStatus, string> = {
  NOT_STARTED: "ยังไม่เริ่ม",
  IN_PROGRESS: "กำลังดำเนินการ",
  COMPLETED: "สำเร็จแล้ว",
};

const ITEM_STATUS_TONE: Record<DevelopmentItemStatus, StatusTone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
};

export function ItemStatusBadge({ status }: { status: DevelopmentItemStatus }) {
  return <StatusChip tone={ITEM_STATUS_TONE[status]} label={ITEM_STATUS_LABEL[status]} />;
}
