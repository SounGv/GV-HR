import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import type { LoanStatus } from "./types";

export const LOAN_STATUS_LABEL: Record<LoanStatus, string> = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
  PAID: "จ่ายแล้ว",
  CANCELLED: "ยกเลิก",
};

const STATUS_TONE: Record<LoanStatus, StatusTone> = {
  PENDING: "warning",
  APPROVED: "primary",
  REJECTED: "danger",
  PAID: "success",
  CANCELLED: "neutral",
};

export function LoanStatusBadge({ status }: { status: LoanStatus }) {
  return <StatusChip tone={STATUS_TONE[status]} label={LOAN_STATUS_LABEL[status]} />;
}
