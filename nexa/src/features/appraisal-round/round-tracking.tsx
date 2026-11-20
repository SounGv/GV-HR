"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CircleCheck, Clock, EyeOff, FileSpreadsheet, ListChecks, MessageSquareText, PencilLine, Printer } from "lucide-react";

import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { StatusChip } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rubricFor } from "@/features/appraisal-form/rating-labels";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useParticipantResult, useRoundMatrix } from "./hooks";
import { ANON_MIN } from "./imported-comments";
import type { RaterType } from "./rules";
import { ASSIGNMENT_STATUS_LABEL, RATER_LABEL, RESULT_STATUS_LABEL, type AssignmentStatus } from "./types";

const STATUS_ICON = { SUBMITTED: CircleCheck, IN_PROGRESS: PencilLine, PENDING: Clock } as const;
const STATUS_CLASS: Record<AssignmentStatus, string> = {
  SUBMITTED: "border-status-normal-border bg-status-normal-bg text-status-normal-fg",
  IN_PROGRESS: "border-status-late-border bg-status-late-bg text-status-late-fg",
  PENDING: "border-border bg-muted text-muted-foreground",
};

/** One line of the check table: a person a rater has to rate, with the state of that sheet. */
interface CheckLine {
  assignmentId: string;
  participantId: string;
  name: string;
  department: string;
  raterType: RaterType;
  status: AssignmentStatus;
  submittedAt: string | null;
  percent: number | null;
}

/** Quotes one cell for a CSV file (Excel opens it). */
const csvCell = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/**
 * "ตรวจเช็คการประเมิน" in the Favpo layout: one row group per rater (No., rater, then the people that rater has to rate with
 * the state of each sheet), with print and Excel at the top right and "only the unfinished" as a filter. Same data as before
 * (the round matrix); only the grouping changed from per person to per rater, which is how HR chases people.
 */
export function RoundMatrix({ roundId, canFill = false }: { roundId: string; canFill?: boolean }) {
  const { data, isLoading, isError, refetch } = useRoundMatrix(roundId, true);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const rows = useMemo(() => data?.data ?? [], [data]);

  const raters = useMemo(() => {
    const by = new Map<string, { key: string; name: string; lines: CheckLine[] }>();
    for (const r of rows) {
      for (const a of r.assignments) {
        const self = a.raterType === "SELF";
        const key = self ? `self:${r.participantId}` : `n:${a.raterName}`;
        const name = self ? `${r.name} (ประเมินตนเอง)` : a.raterName;
        const g = by.get(key) ?? { key, name, lines: [] };
        g.lines.push({
          assignmentId: a.id,
          participantId: r.participantId,
          name: r.name,
          department: r.department,
          raterType: a.raterType,
          status: a.status,
          submittedAt: a.submittedAt,
          percent: a.percent,
        });
        by.set(key, g);
      }
    }
    return [...by.values()].sort((x, y) => x.name.localeCompare(y.name, "th"));
  }, [rows]);

  const openRaters = raters.filter((g) => g.lines.some((l) => l.status !== "SUBMITTED"));
  const shown = (onlyOpen ? openRaters : raters).map((g) => ({ ...g, lines: onlyOpen ? g.lines.filter((l) => l.status !== "SUBMITTED") : g.lines }));

  function downloadExcel() {
    const head = ["No.", "ผู้ประเมิน", "แผนก", "พนักงานที่ต้องประเมิน", "บทบาท", "สถานะ", "วันที่ส่ง", "คะแนน (%)"];
    const lines: string[] = [head.map(csvCell).join(",")];
    shown.forEach((g, i) => {
      for (const l of g.lines) {
        lines.push([i + 1, g.name, l.department, l.name, RATER_LABEL[l.raterType], ASSIGNMENT_STATUS_LABEL[l.status], l.submittedAt ? formatDate(l.submittedAt) : "", l.percent ?? ""].map(csvCell).join(","));
      }
    });
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ตรวจเช็คการประเมิน.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={4} />;

  return (
    <Card className="gap-3 p-4" aria-label="ตรวจเช็คการประเมิน">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ListChecks className="size-5" aria-hidden="true" /> ตรวจเช็คการประเมิน
        </h2>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            aria-pressed={onlyOpen}
            onClick={() => setOnlyOpen((v) => !v)}
            className={cn("min-h-11 rounded-full border px-4 text-sm font-medium md:min-h-9 md:px-3", onlyOpen ? "border-primary bg-accent" : "border-border bg-card")}
          >
            เฉพาะผู้ประเมินที่ยังไม่ครบ ({openRaters.length})
          </button>
          <Button variant="outline" size="sm" className="h-11 md:h-9" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" /> พิมพ์
          </Button>
          <Button variant="outline" size="sm" className="h-11 md:h-9" onClick={downloadExcel} disabled={shown.length === 0}>
            <FileSpreadsheet className="size-4" aria-hidden="true" /> Excel
          </Button>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{rows.length === 0 ? "ยังไม่มีงานประเมินในรอบนี้" : "ทุกคนประเมินครบแล้ว"}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-center">No.</TableHead>
              <TableHead>ผู้ประเมิน</TableHead>
              <TableHead>แผนก</TableHead>
              <TableHead className="w-full">พนักงานที่ต้องประเมิน</TableHead>
              <TableHead>บทบาท</TableHead>
              <TableHead>สถานะ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((g, gi) =>
              g.lines.map((l, li) => {
                const Icon = STATUS_ICON[l.status];
                return (
                  <TableRow key={l.assignmentId}>
                    {li === 0 && (
                      <>
                        <TableCell rowSpan={g.lines.length} className="text-center align-top tabular-nums">
                          {gi + 1}
                        </TableCell>
                        <TableCell rowSpan={g.lines.length} className="align-top font-medium whitespace-normal">
                          {g.name}
                          <span className="block text-xs font-normal text-muted-foreground">
                            ครบ {g.lines.filter((x) => x.status === "SUBMITTED").length}/{g.lines.length}
                          </span>
                        </TableCell>
                      </>
                    )}
                    <TableCell>{l.department}</TableCell>
                    <TableCell className="whitespace-normal">
                      <Link href={`/appraisal/rounds/${roundId}/people/${l.participantId}`} className="hover:text-primary hover:underline">
                        {l.name}
                      </Link>
                    </TableCell>
                    <TableCell>{RATER_LABEL[l.raterType]}</TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold", STATUS_CLASS[l.status])}>
                        <Icon className="size-3.5" aria-hidden="true" />
                        {ASSIGNMENT_STATUS_LABEL[l.status]}
                        {l.submittedAt && ` ${formatDate(l.submittedAt)}`}
                        {l.percent !== null && <span className="tabular-nums"> · ได้ {l.percent}%</span>}
                      </span>
                      {canFill && l.status !== "SUBMITTED" && (
                        <Link href={`/appraisal/rounds/${roundId}/fill/${l.assignmentId}`} className="ml-2 text-xs font-bold text-primary underline underline-offset-2 print:hidden">
                          กรอกแทน
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                );
              }),
            )}
          </TableBody>
        </Table>
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
  const rubric = rubricFor(r.ratingMax, r.ratingLabels);
  const labelOf = new Map(rubric.map((x) => [x.score, x.label]));

  return (
    <div className="space-y-4 pb-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "ประเมิน", href: "/appraisal/rounds" }, { label: r.roundName, href: `/appraisal/rounds/${roundId}` }, { label: r.name }]}
        backHref={`/appraisal/rounds/${roundId}`}
        title={r.name}
        description={`${r.code} · ${r.department}`}
        sticky={false}
      />
      <p className="rounded-lg bg-muted px-4 py-3 text-sm">
        สรุปคำตอบที่ส่งแล้ว แยกตามมุมมองผู้ประเมิน เป็นค่าเฉลี่ยธรรมดา ยังไม่ถ่วงน้ำหนักและยังไม่มีเกรด (รอ HR ยืนยันสูตร)
        {" "}
        {r.namedComments ? "ข้อความที่ผู้ประเมินเขียนอยู่ในการ์ดความเห็นของผู้ประเมินแต่ละคน พร้อมชื่อผู้เขียน (เห็นเฉพาะ HR)" : "ข้อความที่ผู้ประเมินเขียนแสดงโดยไม่ระบุชื่อ"}
      </p>
      {r.namedComments && r.namedComments.length > 0 && (
        <Card className="gap-3 p-4" aria-label="ความเห็นของผู้ประเมินแต่ละคน">
          <h2 className="flex flex-wrap items-center gap-x-2 text-base font-semibold">
            <MessageSquareText className="size-5" aria-hidden="true" /> ความเห็นของผู้ประเมินแต่ละคน
            <span className="text-sm font-medium text-muted-foreground tabular-nums">{r.namedComments.length} ใบ</span>
          </h2>
          <ul className="space-y-2">
            {r.namedComments.map((c) => (
              <li key={c.assignmentId} className="space-y-1.5 rounded-lg border border-border px-3 py-2">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-semibold break-words">{c.raterName}</span>
                  <span className="text-muted-foreground">ประเมิน {r.name}</span>
                  <span className="rounded-md bg-muted px-1.5 text-xs font-medium">{RATER_LABEL[c.raterType]}</span>
                  {c.score !== null && <span className="rounded-md bg-muted px-1.5 text-xs font-bold tabular-nums">ให้ {c.score}/{r.ratingMax}</span>}
                  {c.submittedAt && <span className="text-xs text-muted-foreground tabular-nums">{formatDate(c.submittedAt)}</span>}
                </p>
                {c.texts.map((t, k) => (
                  <p key={k} className="text-sm break-words whitespace-pre-wrap">
                    {t}
                  </p>
                ))}
                <Link href={`/appraisal/rounds/${roundId}/fill/${c.assignmentId}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-2 hover:underline md:min-h-8">
                  เปิดใบประเมินของคนนี้
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card className="gap-1 p-4" aria-label="คะแนนรวม">
        {r.result.status === "NOT_CALCULATED" || r.result.scorePercent == null ? (
          <p className="text-sm text-muted-foreground">ยังไม่ได้คำนวณคะแนน (กดคำนวณผลที่หน้ารอบ)</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">คะแนนรวม · {RESULT_STATUS_LABEL[r.result.status]}</p>
            <p className="text-2xl font-bold tabular-nums">
              {r.result.scorePercent}% {r.result.grade && <span className="text-base font-semibold">· {r.result.grade}</span>}
            </p>
            {r.result.adjustedFrom !== null && (
              <p className="text-sm">
                <StatusChip tone="primary" label="HR ปรับแล้ว" /> คะแนนที่คำนวณได้ {r.result.adjustedFrom}% ดูประวัติที่{" "}
                <Link href={`/appraisal/rounds/${roundId}/review`} className="font-semibold text-primary underline-offset-2 hover:underline">
                  หน้าทบทวนผล
                </Link>
              </p>
            )}
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
      {r.importedComments && (
        <Card className="gap-3 p-4" aria-label="ข้อความจากผู้ประเมิน">
          <h2 className="flex flex-wrap items-center gap-x-2 text-base font-semibold">
            <MessageSquareText className="size-5" aria-hidden="true" /> ข้อความจากผู้ประเมิน
            <span className="text-sm font-medium text-muted-foreground">
              {RATER_LABEL[r.importedComments.raterType as RaterType]} {r.importedComments.raters > 0 ? `${r.importedComments.raters} คน` : ""}
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">นำเข้าจาก{r.importedComments.source === "favpo" ? " Favpo" : "ระบบเดิม"} ไม่ระบุว่าใครเขียน และไม่ได้อยู่ในคะแนนที่คำนวณ</p>
          {r.importedComments.hidden ? (
            <p className="flex items-start gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
              <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                มี {r.importedComments.hiddenCount} ข้อความ แต่ผู้ประเมินกลุ่มนี้มีไม่ถึง {ANON_MIN} คน จึงยังไม่แสดงเพื่อไม่ให้รู้ว่าใครเขียน HR ดูได้ทั้งหมด
              </span>
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {r.importedComments.texts.map((t, k) => (
                <li key={k} className="rounded-lg border border-border px-3 py-2 break-words whitespace-pre-wrap">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {r.groups.length === 0 && !r.importedComments && <EmptyState icon={ListChecks} title="ยังไม่มีผู้ประเมิน" description="รอบนี้ยังไม่มีงานประเมินของคนนี้" />}
      {r.groups.map((g) => (
        <Card key={g.raterType} className="gap-3 p-4">
          <h2 className="text-base font-semibold">
            {RATER_LABEL[g.raterType]} <span className="text-sm font-medium text-muted-foreground tabular-nums">ส่งแล้ว {g.submitted} จาก {g.total} คน</span>
          </h2>
          {g.textsHeld && g.submitted > 0 && (
            <p className="flex items-start gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
              <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>ผู้ประเมินกลุ่มนี้ส่งแล้วไม่ถึง {ANON_MIN} คน จึงยังไม่แสดงข้อความที่เขียน เพื่อไม่ให้รู้ว่าใครเขียน HR ดูได้ทั้งหมด</span>
            </p>
          )}
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
                    <>
                      <p className="text-sm tabular-nums">
                        ค่าเฉลี่ย <b>{s.average ?? "-"}</b> <span className="text-muted-foreground">(จาก {s.count} คน)</span>
                      </p>
                      {s.count > 0 && (
                        <ul className="grid gap-1 text-sm" aria-label="จำนวนคนต่อระดับคะแนน">
                          {s.scores.map((x) => {
                            const desc = s.levelDescriptions?.find((l) => l.score === x.score)?.text;
                            return (
                              <li key={x.score} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-2" title={desc}>
                                <span className="truncate">
                                  <b className="tabular-nums">{x.score}</b> {labelOf.get(x.score) ?? ""}
                                </span>
                                <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                                  <span className="block h-full rounded-full bg-ring" style={{ width: `${s.count ? (x.count / s.count) * 100 : 0}%` }} />
                                </span>
                                <span className="text-muted-foreground tabular-nums">{x.count} คน</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {s.notes.length > 0 && (
                        <ul className="space-y-1.5 text-sm" aria-label="ตัวอย่างเหตุการณ์">
                          {s.notes.map((n, k) => (
                            <li key={k} className="flex gap-2 rounded-lg border border-border px-3 py-2">
                              <span className="shrink-0 rounded-md bg-muted px-1.5 text-xs font-bold tabular-nums">
                                {n.score} {labelOf.get(n.score) ?? ""}
                              </span>
                              <span className="min-w-0 break-words whitespace-pre-wrap">{n.text}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
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
                  {s.texts.length > 0 && !r.namedComments && (
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
