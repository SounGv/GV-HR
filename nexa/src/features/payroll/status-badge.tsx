import { cn } from "@/lib/utils";
import type { PayrollStatus } from "./types";

const LABEL: Record<PayrollStatus, string> = { DRAFT: "ฉบับร่าง", PAID: "จ่ายแล้ว" };
const STYLE: Record<PayrollStatus, string> = {
  DRAFT: "bg-warning/10 text-warning",
  PAID: "bg-success/10 text-success",
};

export function PayrollStatusBadge({ status }: { status: PayrollStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        STYLE[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {LABEL[status]}
    </span>
  );
}
