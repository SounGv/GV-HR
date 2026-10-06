"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, type Envelope } from "@/lib/api/client";
import { AttendanceStatusBadge } from "./status-meta";
import type { EmployeeAttendanceSummary } from "./service";
import type { TodayStatus } from "./status-rules";
import type { TodayPerson } from "./types";

/** What the panel needs to know about the person before the 30-day numbers arrive. */
export interface SheetTarget {
  code: string;
  name: string;
  department: string;
  today?: TodayPerson;
}

const REPORT_STATUS: Record<string, TodayStatus> = {
  PRESENT: "NORMAL",
  LATE: "LATE",
  ABSENT: "ABSENT",
  ON_LEAVE: "ON_LEAVE",
};

/**
 * Side panel for one person: today's status and scan time, and the last 30
 * days. Opens from a row, closes with Esc or a click outside, and Base UI
 * returns focus to the control that opened it. No photo and no location, by
 * design (PDPA); the numbers are for a conversation with the person, not for
 * judging them.
 */
export function EmployeeAttendanceSheet({
  target,
  onClose,
}: {
  target: SheetTarget | null;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState<EmployeeAttendanceSummary | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [attempt, setAttempt] = useState(0);
  const code = target?.code;

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setState("loading");
    setSummary(null);
    api
      .get<Envelope<EmployeeAttendanceSummary>>(`/api/attendance-status/employee?code=${encodeURIComponent(code)}`)
      .then((res) => {
        if (cancelled) return;
        setSummary(res.data);
        setState("idle");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [code, attempt]);

  const today = target?.today;
  return (
    <Sheet open={!!target} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {target && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-10 text-lg break-words">{target.name}</SheetTitle>
              <SheetDescription>
                {target.code} · {target.department}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              {today && (
                <section aria-label="วันนี้" className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">วันนี้</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <AttendanceStatusBadge status={today.status} />
                    {today.lateMinutes != null && (
                      <span className="text-sm text-muted-foreground">สาย {today.lateMinutes} นาที</span>
                    )}
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground">เวลาสแกนเข้า</dt>
                      <dd className="font-medium tabular-nums">{today.clockIn ? `${today.clockIn} น.` : "ยังไม่สแกน"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">กะเริ่ม</dt>
                      <dd className="font-medium tabular-nums">{today.shiftStart} น.</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">วิธีทำงาน</dt>
                      <dd className="font-medium">{today.workMode ?? "-"}</dd>
                    </div>
                  </dl>
                </section>
              )}

              <section aria-label="30 วันล่าสุด" className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">30 วันล่าสุด</h3>
                {state === "loading" && (
                  <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-[spin_2.5s_linear_infinite]" aria-hidden="true" />
                    กำลังโหลด…
                  </p>
                )}
                {state === "error" && (
                  <div role="alert" className="space-y-2 text-sm">
                    <p className="text-muted-foreground">โหลดข้อมูล 30 วันไม่สำเร็จ</p>
                    <Button variant="outline" className="h-11" onClick={() => setAttempt((n) => n + 1)}>
                      ลองอีกครั้ง
                    </Button>
                  </div>
                )}
                {summary && (
                  <>
                    <dl className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { k: "มาทำงาน", v: summary.present },
                        { k: "สาย", v: summary.late },
                        { k: "ขาด", v: summary.absent },
                        { k: "ลา", v: summary.leave },
                      ].map((x) => (
                        <div key={x.k} className="rounded-xl border border-border bg-card px-1 py-2">
                          <dt className="text-xs text-muted-foreground">{x.k}</dt>
                          <dd className="text-xl font-bold tabular-nums">{x.v}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="text-xs text-muted-foreground">
                      ช่อง “ลา” นับเฉพาะลากิจและลาไม่รับค่าจ้างที่ไม่มีบันทึกเวลา ไม่นับลาป่วย
                    </p>
                    {summary.truncatedFrom && (
                      <p className="text-xs text-status-late-fg">ข้อมูลมากเกินกว่าจะนับครบ จึงนับตั้งแต่ {summary.truncatedFrom}</p>
                    )}
                    <ul className="divide-y divide-border">
                      {summary.recent.map((r, i) => (
                        <li key={`${r.date}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span className="tabular-nums">{r.date}</span>
                          <span className="flex items-center gap-2">
                            {r.clockIn !== "-" && <span className="text-muted-foreground tabular-nums">{r.clockIn}</span>}
                            {REPORT_STATUS[r.statusKey] && <AttendanceStatusBadge status={REPORT_STATUS[r.statusKey]} />}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>

              <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                ใช้สำหรับพูดคุยกับพนักงานเป็นรายคน ไม่ใช่ตัดสินจากตัวเลข ไม่แสดงรูปถ่ายหรือตำแหน่ง GPS
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
