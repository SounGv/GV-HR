import { cn } from "@/lib/utils";
import { STATUS_META } from "./status-meta";
import type { TodayStatus } from "./status-rules";
import type { WatchPerson } from "./types";

const REASON_STATUS: Record<"late" | "absent" | "leave", TodayStatus> = {
  late: "LATE",
  absent: "ABSENT",
  leave: "ON_LEAVE",
};

/** Counts as small tags; the one(s) that put the person on the list are strong, the rest are faded. */
export function WatchTags({ person }: { person: WatchPerson }) {
  const items = [
    { key: "absent" as const, n: person.absent, text: "ขาด" },
    { key: "late" as const, n: person.late, text: "สาย" },
    { key: "leave" as const, n: person.leave, text: "ลา" },
  ];
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map(({ key, n, text }) => {
        const meta = STATUS_META[REASON_STATUS[key]];
        const Icon = meta.icon;
        const strong = person.reasons.includes(key);
        return (
          <span
            key={key}
            className={cn(
              "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-semibold",
              strong ? meta.surface : "border-border bg-card text-muted-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {text} {n}
          </span>
        );
      })}
    </span>
  );
}

