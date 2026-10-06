"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck, Clock, ListChecks, PencilLine } from "lucide-react";

import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useParticipantResult, useRoundMatrix } from "./hooks";
import { ASSIGNMENT_STATUS_LABEL, RATER_LABEL, RESULT_STATUS_LABEL, type AssignmentStatus } from "./types";

const STATUS_ICON = { SUBMITTED: CircleCheck, IN_PROGRESS: PencilLine, PENDING: Clock } as const;
const STATUS_CLASS: Record<AssignmentStatus, string> = {
  SUBMITTED: "border-status-normal-border bg-status-normal-bg text-status-normal-fg",
  IN_PROGRESS: "border-status-late-border bg-status-late-bg text-status-late-fg",
  PENDING: "border-border bg-muted text-muted-foreground",
};

/** "ตรวจเช็คการประเมิน": each person in the round with the status of every rater, newest gaps first. */
export function RoundMatrix({ roundId, canFill = false }: { roundId: string; canFill?: boolean }) {
  const { data, isLoading, isError, refetch } = useRoundMatrix(roundId, true);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const rows = data?.data ?? [];
  const shown = onlyOpen ? rows.filter((r) => r.assignments.some((a) => a.status !== "SUBMITTED")) : rows;

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={4} />;

  return (
    <Card className="gap-3 p-4" aria-label="ตรวจเช็คการประเมิน">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ListChecks className="size-5" aria-hidden="true" /> ตรวจเช็คการประเมิน
        </h2>
        <button
          type="button"
          aria-pressed={onlyOpen}
          onClick={() => setOnlyOpen((v) => !v)}
          className={cn("min-h-11 rounded-full border px-4 text-sm font-medium md:min-h-8 md:px-3", onlyOpen ? "border-primary bg-accent" : "border-border bg-card")}
        >
          เฉพาะที่ยังไม่ครบ ({rows.filter((r) => r.assignments.some((a) => a.status !== "SUBMITTED")).length})
        </button>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{rows.length === 0 ? "ยังไม่มีงานประเมินในรอบนี้" : "ทุกคนประเมินครบแล้ว"}</p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((r) => (
            <li key={r.participantId} className="py-3">
              <Link href={`/appraisal/rounds/${roundId}/people/${r.participantId}`} className="block min-h-11 hover:underline">
                <span className="text-sm font-semibold break-words text-foreground">{r.name}</span>{" "}
                <span className="text-sm text-muted-foreground">
                  {r.code} · {r.department}
                </span>
              </Link>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {r.assignments.map((a) => {
                  const Icon = STATUS_ICON[a.status];
                  return (
                    <li
                      key={a.id}
                      className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold", STATUS_CLASS[a.status])}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                      {RATER_LABEL[a.raterType]}
                      {a.raterType === "SELF" ? "" : ` · ${a.raterName}`} · {ASSIGNMENT_STATUS_LABEL[a.status]}
                      {canFill && a.status !== "SUBMITTED" && (
                        <Link href={`/appraisal/rounds/${roundId}/fill/${a.id}`} className="ml-1 font-bold underline underline-offset-2">
                          กรอกแทน
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** One person's answers, summarised per rater type. No names on what people wrote, no weighting, no grade. */
export function ParticipantResultPage({ roundId, participantId }: { roundId: string; participantId: string }) {
  const { data, isLoading, isError, refetch } = useParticipantResult(roundId, participantId);
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !data) return <TableLoadingState rows={4} />;
  const r = data.data;

  return (
    <div className="space-y-4 pb-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "ประเมิน", href: "/appraisal/rounds" }, { label: r.roundName, href: `/appraisal/rounds/${roundId}` }, { label: r.name }]}
        backHref={`/appraisal/rounds/${roundId}`}
        title={r.name}
        description={`${r.code} · ${r.department}`}
        sticky={false}
      />
      <p className="rounded-xl bg-muted px-4 py-3 text-sm">
        สรุปคำตอบที่ส่งแล้ว แยกตามมุมมองผู้ประเมิน เป็นค่าเฉลี่ยธรรมดา ยังไม่ถ่วงน้ำหนักและยังไม่มีเกรด (รอ HR ยืนยันสูตร)
        ข้อความที่ผู้ประเมินเขียนแสดงโดยไม่ระบุชื่อ
      </p>
      <Card className="gap-1 p-4" aria-label="คะแนนรวม">
        {r.result.status === "NOT_CALCULATED" || r.result.scorePercent == null ? (
          <p className="text-sm text-muted-foreground">ยังไม่ได้คำนวณคะแนน (กดคำนวณผลที่หน้ารอบ)</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">คะแนนรวม · {RESULT_STATUS_LABEL[r.result.status]}</p>
            <p className="text-2xl font-bold tabular-nums">
              {r.result.scorePercent}% {r.result.grade && <span className="text-base font-semibold">· {r.result.grade}</span>}
            </p>
            {r.result.types.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground tabular-nums">
                {r.result.types.map((t) => (
                  <li key={t.raterType}>
                    {RATER_LABEL[t.raterType]}: {t.percent}% (น้ำหนักที่ใช้ {t.weightUsed}%, {t.raters} คน)
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>
      {r.groups.length === 0 && <EmptyState icon={ListChecks} title="ยังไม่มีผู้ประเมิน" description="รอบนี้ยังไม่มีงานประเมินของคนนี้" />}
      {r.groups.map((g) => (
        <Card key={g.raterType} className="gap-3 p-4">
          <h2 className="text-base font-semibold">
            {RATER_LABEL[g.raterType]} <span className="text-sm font-normal text-muted-foreground tabular-nums">ส่งแล้ว {g.submitted} จาก {g.total} คน</span>
          </h2>
          {g.submitted === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีผู้ประเมินกลุ่มนี้ส่งผล</p>
          ) : (
            <ol className="space-y-4">
              {g.summary.map((s, i) => (
                <li key={s.questionId} className="space-y-1.5">
                  <p className="text-sm font-semibold">
                    {i + 1}. {s.text}
                  </p>
                  {s.answerType === "RATING" && (
                    <p className="text-sm tabular-nums">
                      ค่าเฉลี่ย <b>{s.average ?? "-"}</b> <span className="text-muted-foreground">(จาก {s.count} คน)</span>
                    </p>
                  )}
                  {s.options.length > 0 && (
                    <ul className="space-y-0.5 text-sm">
                      {s.options.map((o) => (
                        <li key={o.label} className="flex justify-between gap-3">
                          <span>{o.label}</span>
                          <span className="text-muted-foreground tabular-nums">{o.count} คน</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.texts.length > 0 && (
                    <ul className="space-y-1.5 text-sm">
                      {s.texts.map((t, k) => (
                        <li key={k} className="rounded-lg border border-border px-3 py-2 break-words whitespace-pre-wrap">
                          {t}
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.count === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีคำตอบ</p>}
                </li>
              ))}
            </ol>
          )}
        </Card>
      ))}
    </div>
  );
}
