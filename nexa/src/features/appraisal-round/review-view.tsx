"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardCheck } from "lucide-react";

import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ManagerStatus } from "./review-rules";
import { AdjustDialog } from "./adjust-dialog";
import { useRoundReview } from "./hooks";
import { RESULT_STATUS_LABEL, type ReviewPerson, type ReviewSpread } from "./types";

const STEPS = ["คำนวณผล", "ทบทวนผล", "อนุมัติ", "ประกาศผล"] as const;

const MANAGER_CHIP: Record<ManagerStatus, { tone: StatusTone; label: string }> = {
  ok: { tone: "success", label: "ปกติ" },
  high: { tone: "warning", label: "สูงกว่าที่อื่น ควรตรวจ" },
  low: { tone: "warning", label: "ต่ำกว่าที่อื่น ควรตรวจ" },
  few: { tone: "neutral", label: "ข้อมูลน้อย ไม่แสดงค่า" },
};

/** The ten highest totals, ranked 1, 2, 2, 4 ... (people with the same score share a rank). More than ten rows only when the tenth place is tied. */
function topTen(people: ReviewPerson[]): { rank: number; person: ReviewPerson }[] {
  const sorted = [...people].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "th"));
  const ranked = sorted.map((person, i) => ({ rank: i > 0 && person.total === sorted[i - 1]!.total ? 0 : i + 1, person }));
  for (let i = 1; i < ranked.length; i++) if (ranked[i]!.rank === 0) ranked[i]!.rank = ranked[i - 1]!.rank;
  const tenth = ranked[9]?.person.total;
  return ranked.filter((x, i) => i < 10 || (tenth !== undefined && x.person.total === tenth));
}

const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}`;
const when = (iso: string) => new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * "ทบทวนผล": a read-only look at a round's calculated results before they are approved. It shows how grades are spread,
 * how generously each manager scored, and which people deserve a second look. It never changes a score or a grade.
 */
export function RoundReviewPage({ roundId }: { roundId: string }) {
  const { data, isLoading, isError, error, refetch } = useRoundReview(roundId);
  const [dept, setDept] = useState<string>("all");
  const [target, setTarget] = useState<ReviewPerson | null>(null);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <TableLoadingState rows={4} />;
  const r = data.data;
  const who = r.companyWide ? "ทั้งบริษัท" : "คนที่คุณดูได้";

  const spread: ReviewSpread & { total: number } =
    dept === "all" ? { ...r.spread, total: r.calculated } : (r.spread.byDepartment.find((d) => d.department === dept) ?? { counts: r.bands.map(() => 0), below: 0, total: 0 });
  const totalAll = r.calculated;
  const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

  return (
    <div className="space-y-4 pb-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "ประเมิน", href: "/appraisal/rounds" }, { label: r.roundName, href: `/appraisal/rounds/${roundId}` }, { label: "ทบทวนผล" }]}
        backHref={`/appraisal/rounds/${roundId}`}
        title="ทบทวนผล"
        description={r.roundName}
        sticky={false}
      />

      <Card className="gap-2 p-4" aria-label="สถานะการทบทวน">
        <p className="text-sm tabular-nums">
          คำนวณแล้ว <b>{r.calculated}</b> จาก <b>{r.total}</b> คน{r.total > r.calculated && ` อีก ${r.total - r.calculated} คนยังไม่มีผลคำนวณ`}
        </p>
        <ol className="flex flex-wrap gap-2" aria-label="ขั้นตอนของผล">
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={i === 1 ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-sm border py-0.5 pr-3 pl-1 text-sm",
                i === 1 ? "border-primary bg-accent font-semibold text-accent-foreground" : "border-border bg-card text-muted-foreground",
              )}
            >
              <span className={cn("grid size-6 place-items-center rounded-full text-xs", i === 1 ? "bg-primary text-primary-foreground" : "bg-muted")}>{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          {r.canAdjust
            ? `ใช้ตรวจก่อนไปอนุมัติผล HR ปรับคะแนนได้ไม่เกิน ${r.thresholds.maxAdjust} จุดจากคะแนนที่คำนวณได้ ต้องเขียนเหตุผลทุกครั้ง และพนักงานไม่เห็นประวัติการปรับ`
            : "หน้านี้ดูอย่างเดียว ไม่เปลี่ยนคะแนนหรือเกรดของใคร ใช้ตรวจก่อนไปอนุมัติผล การปรับคะแนนทำได้เฉพาะ HR"}
        </p>
      </Card>

      {r.imported && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          รอบนี้นำเข้าจาก Favpo มีเฉพาะคะแนนรวมของแต่ละคน ไม่มีคะแนนแยกตนเองกับหัวหน้า และไม่มีค่าเฉลี่ยของหัวหน้า จึงซ่อนส่วนนั้นไว้
        </p>
      )}

      {r.calculated === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="ยังไม่มีผลให้ทบทวน"
          description="ยังไม่ได้คำนวณผล หรือผู้ประเมินยังไม่ส่งคำตอบ กลับไปที่หน้ารอบแล้วกด คำนวณผล"
          action={
            <Link href={`/appraisal/rounds/${roundId}`} className={buttonVariants({ variant: "outline" })}>
              กลับไปที่หน้ารอบ
            </Link>
          }
        />
      ) : (
        <>
          <Card className="gap-3 p-4" aria-label="การกระจายเกรด">
            <h2 className="text-base font-semibold">การกระจายเกรด</h2>
            {r.ceiling.flag && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                <StatusChip tone="warning" label="คะแนนกระจุกที่เต็ม" />
                <span className="tabular-nums">
                  {r.ceiling.count} จาก {r.ceiling.total} คนได้ 100% ({pct(r.ceiling.count, r.ceiling.total)}%) จึงแยกคนที่ทำได้ดีกว่ากันไม่ได้ ดูรายคนด้านล่างก่อนอนุมัติ
                </span>
              </div>
            )}
            {r.bands.length === 0 ? (
              <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                ยังไม่ได้ตั้งเกณฑ์เกรด จึงยังนับการกระจายไม่ได้{" "}
                <Link href="/appraisal/settings" className="font-semibold text-primary underline-offset-2 hover:underline">
                  ตั้งเกณฑ์เกรด
                </Link>
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2" role="group" aria-label="เลือกแผนก">
                  {["all", ...r.spread.byDepartment.map((d) => d.department)].map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={dept === d}
                      onClick={() => setDept(d)}
                      className={cn(
                        "min-h-11 rounded-sm border px-4 text-sm font-medium md:min-h-9",
                        dept === d ? "border-foreground bg-foreground text-background" : "border-border bg-card",
                      )}
                    >
                      {d === "all" ? "ทุกแผนก" : d}
                    </button>
                  ))}
                </div>
                <ul className="space-y-2" aria-live="polite">
                  {r.bands.map((label, i) => (
                    <li key={label} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[7rem_1fr_6.5rem]">
                      <span>{label}</span>
                      <span className="order-last col-span-2 h-4 overflow-hidden rounded-full bg-muted sm:order-none sm:col-span-1" aria-hidden="true">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${pct(spread.counts[i], spread.total)}%` }} />
                      </span>
                      <span className="text-right text-muted-foreground tabular-nums">
                        {spread.counts[i]} คน ({pct(spread.counts[i], spread.total)}%)
                      </span>
                    </li>
                  ))}
                  {spread.below > 0 && (
                    <li className="text-sm text-muted-foreground tabular-nums">{spread.below} คนมีคะแนนต่ำกว่าเกณฑ์ทุกระดับที่ตั้งไว้</li>
                  )}
                </ul>
                {dept !== "all" && totalAll > 0 && (
                  <p className="text-sm text-muted-foreground tabular-nums">
                    แผนกนี้ {spread.total} คน จากทั้งหมด {totalAll} คน
                  </p>
                )}
              </>
            )}
          </Card>

          {r.people.length >= 3 && (
            <Card className="gap-3 p-4" aria-label="10 อันดับคะแนนสูงสุด">
              <div>
                <h2 className="text-base font-semibold">10 อันดับคะแนนสูงสุด</h2>
                <p className="text-sm text-muted-foreground">เรียงตามคะแนนรวมของรอบนี้ ใช้ดูอย่างเดียว ไม่เปลี่ยนคะแนนหรือเกรด คนที่คะแนนเท่ากันได้อันดับเดียวกัน</p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="w-16 px-3 py-2 font-semibold">อันดับ</th>
                      <th className="px-3 py-2 font-semibold">พนักงาน</th>
                      <th className="px-3 py-2 font-semibold">แผนก</th>
                      <th className="px-3 py-2 text-right font-semibold">คะแนน (%)</th>
                      {r.bands.length > 0 && <th className="px-3 py-2 font-semibold">เกรด</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topTen(r.people).map((x) => (
                      <tr key={x.person.participantId}>
                        <td className="px-3 py-2 tabular-nums">{x.rank}</td>
                        <td className="px-3 py-2">
                          <Link href={`/appraisal/rounds/${roundId}/people/${x.person.participantId}`} className="font-medium text-primary hover:underline">
                            {x.person.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{x.person.department}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{x.person.total.toFixed(1)}</td>
                        {r.bands.length > 0 && <td className="px-3 py-2">{x.person.grade ?? "-"}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {!r.imported && (
          <Card className="gap-3 p-4" aria-label="ค่าเฉลี่ยที่หัวหน้าแต่ละคนให้">
            <div>
              <h2 className="text-base font-semibold">ค่าเฉลี่ยที่หัวหน้าแต่ละคนให้</h2>
              <p className="text-sm text-muted-foreground">
                เทียบกับค่าเฉลี่ย{who} {r.managers.companyAverage ?? "-"}% ขึ้นคำเตือนเมื่อต่างเกิน {r.thresholds.managerGap} จุด และไม่แสดงค่าของหัวหน้าที่ประเมินน้อยกว่า{" "}
                {r.thresholds.minPeople} คน
              </p>
            </div>
            {r.managers.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มีหัวหน้าที่ส่งคำตอบ</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left font-medium">หัวหน้า</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">ประเมินกี่คน</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">ค่าเฉลี่ยที่ให้ (%)</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">ต่างจากค่าเฉลี่ย</th>
                      <th scope="col" className="px-3 py-2 text-left font-medium">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {r.managers.rows.map((m) => (
                      <tr key={m.managerId}>
                        <td className="px-3 py-2 font-medium break-words">{m.name}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{m.count}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{m.average ?? "-"}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{m.diff === null ? "-" : signed(m.diff)}</td>
                        <td className="px-3 py-2">
                          <StatusChip tone={MANAGER_CHIP[m.status].tone} label={MANAGER_CHIP[m.status].label} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          )}

          <Card className="gap-3 p-4" aria-label="รายคน">
            <div>
              <h2 className="text-base font-semibold">รายคน</h2>
              <p className="text-sm text-muted-foreground">
                ช่องว่างคือคะแนนตนเองลบคะแนนหัวหน้า ถ้าห่างตั้งแต่ {r.thresholds.selfGap} จุดขึ้นป้าย ควรคุย และถ้าอยู่ห่างขอบเกรดไม่ถึง 1 จุดขึ้นป้าย ใกล้ขอบเกรด คนที่มีป้ายอยู่บนสุด
              </p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">ชื่อ</th>
                    {!r.imported && <th scope="col" className="px-2 py-2 text-right font-medium">ตนเอง (%)</th>}
                    {!r.imported && <th scope="col" className="px-2 py-2 text-right font-medium">หัวหน้า (%)</th>}
                    <th scope="col" className="px-2 py-2 text-right font-medium">รวม (%)</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">เกรด</th>
                    {!r.imported && <th scope="col" className="px-2 py-2 text-right font-medium">ช่องว่าง</th>}
                    <th scope="col" className="px-3 py-2 text-left font-medium">ข้อสังเกต</th>
                    {r.canAdjust && (
                      <th scope="col" className="px-3 py-2 text-left font-medium">
                        <span className="sr-only">ปรับคะแนน</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {r.people.map((p) => (
                    <tr key={p.participantId}>
                      <td className="px-3 py-2">
                        <Link href={`/appraisal/rounds/${roundId}/people/${p.participantId}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {p.department} · {RESULT_STATUS_LABEL[p.status]}
                        </span>
                      </td>
                      {!r.imported && <td className="px-2 py-2 text-right tabular-nums">{p.self ?? "-"}</td>}
                      {!r.imported && <td className="px-2 py-2 text-right tabular-nums">{p.manager ?? "-"}</td>}
                      <td className="px-2 py-2 text-right tabular-nums">
                        <span className="font-semibold">{p.total}</span>
                        {p.adjusted && p.original !== null && <span className="block text-xs text-muted-foreground">คำนวณได้ {p.original}</span>}
                      </td>
                      <td className="px-2 py-2">{p.grade ?? "-"}</td>
                      {!r.imported && <td className="px-2 py-2 text-right tabular-nums">{p.gap === null ? "-" : signed(p.gap)}</td>}
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {p.talk && <StatusChip tone="warning" label="ควรคุย ตนเองสูงกว่าหัวหน้า" />}
                          {p.nearEdge && <StatusChip tone="info" label="ใกล้ขอบเกรด" />}
                          {p.adjusted && <StatusChip tone="primary" label="HR ปรับแล้ว" />}
                          {!p.talk && !p.nearEdge && !p.adjusted && <span className="text-muted-foreground">-</span>}
                        </div>
                      </td>
                      {r.canAdjust && (
                        <td className="px-3 py-2">
                          {p.status === "CALCULATED" ? (
                            <Button variant="outline" className="h-11 md:h-8" onClick={() => setTarget(p)}>
                              ปรับคะแนน
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">{p.status === "NOT_CALCULATED" ? "-" : "อนุมัติแล้ว ปรับไม่ได้"}</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {(r.canAdjust || r.adjustments.length > 0) && (
            <Card className="gap-3 p-4" aria-label="ประวัติการปรับคะแนน">
              <div>
                <h2 className="text-base font-semibold">ประวัติการปรับคะแนน</h2>
                <p className="text-sm text-muted-foreground">เห็นเฉพาะ HR และผู้อนุมัติ พนักงานเห็นแค่คะแนนและเกรดสุดท้าย</p>
              </div>
              {r.adjustments.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีการปรับคะแนนในรอบนี้ กด ปรับคะแนน ในตารางรายคนเพื่อเริ่ม</p>
              ) : (
                <ul className="space-y-2">
                  {r.adjustments.map((a) => (
                    <li key={a.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <p className="font-medium break-words">
                        {a.name} {a.kind === "ADJUST" ? "ปรับคะแนน" : "ยกเลิกการปรับ"}
                      </p>
                      <p className="tabular-nums">
                        จาก {a.fromPercent} เป็น {a.toPercent}
                        {a.fromGrade !== a.toGrade && ` เกรดเปลี่ยนจาก ${a.fromGrade ?? "-"} เป็น ${a.toGrade ?? "-"}`}
                      </p>
                      <p className="break-words">เหตุผล {a.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        โดย {a.byName} {when(a.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card className="gap-2 p-4" aria-label="ขั้นต่อไป">
            <h2 className="text-base font-semibold">ขั้นต่อไป</h2>
            <p className="text-sm text-muted-foreground">ทบทวนเสร็จแล้ว กลับไปที่หน้ารอบเพื่ออนุมัติหรือประกาศผล</p>
            <div>
              <Link href={`/appraisal/rounds/${roundId}`} className={buttonVariants({ className: "h-11 md:h-9" })}>
                ไปอนุมัติผลที่หน้ารอบ <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </Card>
        </>
      )}
      {r.canAdjust && <AdjustDialog roundId={roundId} person={target} onClose={() => setTarget(null)} />}
    </div>
  );
}
