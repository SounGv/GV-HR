"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, type Envelope } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { EmployeeLeaveYear, LeaveRequestLine } from "./leave-detail";

export interface LeaveSheetTarget {
  code: string;
  name: string;
}

const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

function when(r: LeaveRequestLine): string {
  const range = r.startIso === r.endIso ? fmtDay(r.startIso) : `${fmtDay(r.startIso)} – ${fmtDay(r.endIso)}`;
  return range;
}

function amount(r: LeaveRequestLine): string {
  if (r.hours != null) return `${r.hours} ชม.`;
  return r.halfDay ? "ครึ่งวัน" : `${r.days} วัน`;
}

const STATUS_TONE: Record<string, string> = {
  APPROVED: "border-status-normal-border bg-status-normal-bg text-status-normal-fg",
  PENDING: "border-status-late-border bg-status-late-bg text-status-late-fg",
  REJECTED: "border-border bg-muted text-muted-foreground line-through decoration-1",
  CANCELLED: "border-border bg-muted text-muted-foreground line-through decoration-1",
};

/**
 * Side panel for one person on the leave report: per-type entitlement, used,
 * remaining and pending for the year, then every leave request with its dates
 * and status. Reasons and attachments are never loaded.
 */
export function LeaveEmployeeSheet({
  target,
  year,
  onClose,
}: {
  target: LeaveSheetTarget | null;
  year: number;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<EmployeeLeaveYear | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [attempt, setAttempt] = useState(0);
  const code = target?.code;

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setState("loading");
    setDetail(null);
    api
      .get<Envelope<EmployeeLeaveYear>>(`/api/reports/leave-employee?code=${encodeURIComponent(code)}&year=${year}`)
      .then((res) => {
        if (cancelled) return;
        setDetail(res.data);
        setState("idle");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [code, year, attempt]);

  return (
    <Sheet open={!!target} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {target && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-10 text-lg break-words">{target.name}</SheetTitle>
              <SheetDescription>
                {target.code}
                {detail ? ` · ${detail.department}` : ""} · วันลาปี {year}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              {state === "loading" && (
                <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-[spin_2.5s_linear_infinite]" aria-hidden="true" />
                  กำลังโหลด…
                </p>
              )}
              {state === "error" && (
                <div role="alert" className="space-y-2 text-sm">
                  <p className="text-muted-foreground">โหลดข้อมูลการลาไม่สำเร็จ</p>
                  <Button variant="outline" className="h-11" onClick={() => setAttempt((n) => n + 1)}>
                    ลองอีกครั้ง
                  </Button>
                </div>
              )}

              {detail && (
                <>
                  <section aria-label="สิทธิ์ลาและที่ใช้ไป" className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">สิทธิ์ลา ใช้ไป และคงเหลือ (วัน)</h3>
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-muted-foreground">
                          <tr>
                            <th scope="col" className="px-3 py-2 text-left font-medium">ประเภท</th>
                            <th scope="col" className="px-2 py-2 text-right font-medium">สิทธิ์</th>
                            <th scope="col" className="px-2 py-2 text-right font-medium">ใช้ไป</th>
                            <th scope="col" className="px-2 py-2 text-right font-medium">คงเหลือ</th>
                            <th scope="col" className="px-3 py-2 text-right font-medium">รออนุมัติ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {detail.types.map((t) => (
                            <tr key={t.type}>
                              <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">{t.label}</th>
                              <td className="px-2 py-2 text-right tabular-nums">{t.total ?? "-"}</td>
                              <td className="px-2 py-2 text-right tabular-nums">{t.used}</td>
                              <td className={cn("px-2 py-2 text-right font-semibold tabular-nums", t.left === 0 && "text-status-absent-fg")}>
                                {t.left ?? "-"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">{t.pending || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ลาไม่รับค่าจ้างและลาอื่นๆ ไม่มีสิทธิ์ให้หัก จึงแสดงเฉพาะที่ใช้ไป
                      ลาเป็นชั่วโมงรวมเป็นเศษวันในช่อง “ใช้ไป” ส่วน “รออนุมัติ” ยังไม่ถูกหักจากคงเหลือ
                    </p>
                  </section>

                  <section aria-label="รายการลา" className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      รายการลา <span className="tabular-nums">({detail.requests.length})</span>
                    </h3>
                    {detail.types.some((t) => t.untracked > 0) && (
                      <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                        ยอดที่ใช้ไปบางส่วนยังไม่มีวันที่ในระบบ (ยกยอดมาจากระบบเดิมหรือ HR ปรับให้):{" "}
                        {detail.types
                          .filter((t) => t.untracked > 0)
                          .map((t) => `${t.label} ${t.untracked} วัน`)
                          .join(", ")}
                      </p>
                    )}
                    {detail.requests.length === 0 ? (
                      <p className="text-sm text-muted-foreground">ปีนี้ยังไม่มีรายการลา</p>
                    ) : (
                      <ul className="divide-y divide-border rounded-xl border border-border">
                        {detail.requests.map((r) => (
                          <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5">
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-foreground">{r.typeLabel}</span>
                              <span className="block text-sm text-muted-foreground tabular-nums">
                                {when(r)} · {amount(r)}
                              </span>
                            </span>
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                                STATUS_TONE[r.status] ?? "border-border bg-muted text-muted-foreground",
                              )}
                            >
                              {r.statusLabel}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
