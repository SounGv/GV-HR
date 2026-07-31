import { cn } from "@/lib/utils";
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
  other: "อื่น ๆ",
};

const STATUS_STYLE: Record<ExpenseStatus, string> = {
  PENDING: "bg-warning/10 text-warning",
  APPROVED: "bg-primary/10 text-primary",
  REJECTED: "bg-destructive/10 text-destructive",
  PAID: "bg-success/10 text-success",
  CANCELLED: "bg-muted text-muted-foreground",
};

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_STYLE[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {EXPENSE_STATUS_LABEL[status]}
    </span>
  );
}
