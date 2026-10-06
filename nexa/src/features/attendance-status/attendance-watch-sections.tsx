import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STATUS_META, watchListHref } from "./status-meta";
import { WATCH_ABSENT_DAYS, WATCH_LATE_COUNT, WATCH_LEAVE_COUNT, type TodayStatus } from "./status-rules";
import type { AttendanceWatch, WatchPerson } from "./types";

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
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
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

interface WatchProps {
  data: AttendanceWatch;
  departmentIds: string[];
}

/** E. People who reached a threshold in the last 30 days, for a one-to-one conversation, not for judging by numbers. */
export function WatchlistCard({ data, departmentIds }: WatchProps) {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">ควรติดตาม ({data.windowDays} วันล่าสุด)</CardTitle>
        <p className="text-sm text-muted-foreground">
          เข้าเกณฑ์เมื่อสาย ≥ {WATCH_LATE_COUNT} ครั้ง, ขาด ≥ {WATCH_ABSENT_DAYS} วัน หรือลากิจ/ไม่รับค่าจ้าง ≥ {WATCH_LEAVE_COUNT}{" "}
          ครั้ง (ไม่นับลาป่วย) ใช้สำหรับพูดคุยกับพนักงานเป็นรายคน ไม่ใช่ตัดสินจากตัวเลข
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.people.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีใครเข้าเกณฑ์ติดตาม</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.people.slice(0, 6).map((p) => (
              <li key={p.code} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold break-words text-foreground">{p.name}</span>
                  <span className="block text-sm text-muted-foreground">{p.department}</span>
                </span>
                <WatchTags person={p} />
              </li>
            ))}
          </ul>
        )}
        {data.truncatedFrom && (
          <p className="text-sm text-status-late-fg">ข้อมูลมากเกินกว่าจะนับครบ จึงนับตั้งแต่ {data.truncatedFrom} เป็นต้นไป</p>
        )}
        {data.people.length > 6 && (
          <Link
            href={watchListHref("all", departmentIds)}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
          >
            ดูทั้งหมด {data.people.length} คน <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

/** E. Departments with the most late + absent days per person; hidden when a department is already chosen. */
export function DepartmentWatchCard({ data }: { data: AttendanceWatch }) {
  const top = data.departments.slice(0, 4);
  return (
    <Card className="gap-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">แผนกที่ควรจับตา ({data.windowDays} วันล่าสุด)</CardTitle>
        <p className="text-sm text-muted-foreground">เรียงตามจำนวนครั้งที่สายและขาดเฉลี่ยต่อคน</p>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีแผนกที่มีสายหรือขาด</p>
        ) : (
          <ol className="divide-y divide-border">
            {top.map((d, i) => (
              <li key={d.department} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 text-sm">
                  <span className="font-semibold break-words text-foreground">
                    {i + 1}. {d.department}
                  </span>
                  <span className="block text-muted-foreground">
                    {d.people} คน · สาย {d.late} · ขาด {d.absent}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm">
                  <b className="text-lg tabular-nums">{d.perPerson.toFixed(1)}</b>
                  <span className="block text-muted-foreground">ครั้ง/คน</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
