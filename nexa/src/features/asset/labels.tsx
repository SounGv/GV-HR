import { cn } from "@/lib/utils";
import type { AssetStatus } from "./types";

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  AVAILABLE: "ว่าง",
  ASSIGNED: "เบิกใช้",
  REPAIR: "ซ่อมบำรุง",
  RETIRED: "ปลดระวาง",
};

const STYLE: Record<AssetStatus, string> = {
  AVAILABLE: "bg-success/10 text-success",
  ASSIGNED: "bg-info/10 text-info",
  REPAIR: "bg-warning/10 text-warning",
  RETIRED: "bg-muted text-muted-foreground",
};

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        STYLE[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {ASSET_STATUS_LABEL[status]}
    </span>
  );
}
