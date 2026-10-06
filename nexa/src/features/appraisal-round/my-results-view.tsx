"use client";

import { CircleCheck, Lock, ListChecks } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api/client";
import { useAcknowledge, useMyResults } from "./hooks";
import { RATER_LABEL } from "./types";

const fmt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(iso)) : "";

/** "ผลประเมินของฉัน": only results HR has published, and only when the company lets people see them. */
export function MyResultsView() {
  const { data, isLoading, isError, refetch } = useMyResults();
  const ack = useAcknowledge();
  const results = data?.data ?? [];

  async function onAck(id: string) {
    try {
      await ack.mutateAsync(id);
      toast.success("รับทราบผลแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ทำรายการไม่สำเร็จ");
    }
  }

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={3} />;
  if (results.length === 0) {
    return <EmptyState icon={ListChecks} title="ยังไม่มีผลประเมินที่ประกาศ" description="เมื่อ HR ประกาศผลและเปิดให้ดู ผลของคุณจะแสดงที่นี่" />;
  }

  return (
    <div className="space-y-4">
      {results.map((r) => (
        <Card key={r.participantId} className="gap-3 p-4">
          <div>
            <h2 className="text-base font-semibold break-words">{r.roundName}</h2>
            <p className="text-sm text-muted-foreground">ประกาศเมื่อ {fmt(r.publishedAt)}</p>
          </div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <p className="text-sm text-muted-foreground">คะแนนรวม</p>
              <p className="text-3xl font-bold tabular-nums">{r.scorePercent ?? "-"}<span className="text-base font-medium text-muted-foreground"> %</span></p>
              {r.overallScore != null && (
                <p className="text-sm text-muted-foreground tabular-nums">
                  {r.overallScore} จาก {r.ratingMax}
                </p>
              )}
            </div>
            {r.grade && (
              <div>
                <p className="text-sm text-muted-foreground">ระดับ</p>
                <p className="text-xl font-semibold">{r.grade}</p>
              </div>
            )}
          </div>

          {r.types.length > 0 && (
            <ul className="space-y-1 text-sm" aria-label="คะแนนตามมุมมอง">
              {r.types.map((t) => (
                <li key={t.raterType} className="flex justify-between gap-3">
                  <span>{RATER_LABEL[t.raterType]}</span>
                  <span className="text-muted-foreground tabular-nums">{t.percent}%</span>
                </li>
              ))}
            </ul>
          )}

          {r.comments.map((c) => (
            <section key={c.raterType} className="space-y-1.5" aria-label={`ความเห็นจาก${RATER_LABEL[c.raterType]}`}>
              <h3 className="text-sm font-semibold">ความเห็นจาก{RATER_LABEL[c.raterType]}</h3>
              <ul className="space-y-1.5 text-sm">
                {c.texts.map((t, i) => (
                  <li key={i} className="rounded-lg border border-border px-3 py-2 break-words whitespace-pre-wrap">
                    {t}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {r.hiddenGroups.length > 0 && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              ผลจาก{r.hiddenGroups.map((g) => RATER_LABEL[g]).join(" และ ")}ยังไม่แสดงแยก เพราะมีผู้ประเมินน้อยกว่า 3 คน (เพื่อไม่ให้ระบุตัวผู้ประเมินได้)
            </p>
          )}

          {r.needsAck ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2">
              <p className="text-sm">กรุณากดรับทราบผล{r.ackDays ? ` ภายใน ${r.ackDays} วัน` : ""}</p>
              <Button className="h-11 md:h-9" onClick={() => onAck(r.participantId)} disabled={ack.isPending}>
                รับทราบผล
              </Button>
            </div>
          ) : (
            r.status === "ACKNOWLEDGED" && (
              <p className="flex items-center gap-2 text-sm text-success">
                <CircleCheck className="size-4" aria-hidden="true" /> รับทราบผลแล้ว
              </p>
            )
          )}
        </Card>
      ))}
    </div>
  );
}
