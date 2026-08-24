import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import type { ExpenseCategory, ExpenseStatus } from "./types";

export const EXPENSE_STATUS_LABEL: Record<ExpenseStatus, string> = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
  PAID: "จ่ายแล้ว",
  CANCELLED: "ยกเลิก",
};

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  travel: "เดินทาง",
  food: "อาหาร",
  supplies: "อุปกรณ์",
  accommodation: "ที่พัก",
  medical: "ค่ารักษาพยาบาล",
  other: "อื่น ๆ",
};

const STATUS_TONE: Record<ExpenseStatus, StatusTone> = {
  PENDING: "warning",
  APPROVED: "primary",
  REJECTED: "danger",
  PAID: "success",
  CANCELLED: "neutral",
};

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  return <StatusChip tone={STATUS_TONE[status]} label={EXPENSE_STATUS_LABEL[status]} />;
}
