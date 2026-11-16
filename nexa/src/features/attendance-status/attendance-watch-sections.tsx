import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { watchListHref } from "./status-meta";
import { WATCH_ABSENT_DAYS, WATCH_LATE_COUNT, WATCH_LEAVE_COUNT } from "./status-rules";
import type { AttendanceWatch } from "./types";
import { WatchPeopleRows } from "./watch-people-list";

function DeptRow({ href, label, children }: { href?: string; label: string; children: React.ReactNode }) {
  const cls = "gv-row group -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5";
  if (!href) return <div className={cls}>{children}</div>;
  return (
    <Link href={href} aria-label={label} prefetch={false} className={`${cls} focus-visible:outline-2 focus-visible:outline-primary`}>
      {children}
      <ChevronRight className="size-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
    </Link>
  );
}

interface WatchProps {
  data: AttendanceWatch;
  departmentIds: string[];
}

/** E. People who reached a threshold in the last 30 days, for a one-to-one conversation, not for judging by numbers. */
export function WatchlistCard({ data, departmentIds }: WatchProps) {
  return (
    <Card className="gv-panel gv-panel-lift gap-0">
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
          <WatchPeopleRows people={data.people.slice(0, 6)} />
        )}
        {data.truncatedFrom && (
          <p className="text-sm text-status-late-fg">ข้อมูลมากเกินกว่าจะนับครบ จึงนับตั้งแต่ {data.truncatedFrom} เป็นต้นไป</p>
        )}
        {data.people.length > 6 && (
          <Link
            href={watchListHref("all", departmentIds)}
            // The full list is a heavy page to build; open it on click, not when the link scrolls into view.
            prefetch={false}
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
    <Card className="gv-panel gv-panel-lift gap-0">
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
              <li key={d.department}>
                {/* A department with an id opens the 30-day list narrowed to it; the page keeps the same filter name as the filter bar. */}
                <DeptRow href={d.departmentId ? watchListHref("all", [d.departmentId]) : undefined} label={`${d.department} ดูรายชื่อติดตาม`}>
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
                </DeptRow>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
