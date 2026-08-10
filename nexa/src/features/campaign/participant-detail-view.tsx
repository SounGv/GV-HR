"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, Loader2, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScorePicker } from "@/components/shared/score-picker";
import { TemplateFormRenderer } from "@/features/evaluation-template/template-renderer";
import type { TemplateSection } from "@/features/evaluation-template/types";
import { fullName } from "@/lib/format";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/features/auth/auth-context";
import { useOrgOptions } from "@/features/employee/hooks";
import { sendChat } from "@/features/ai/api";
import { groupByCategory } from "@/lib/competency-grouping";
import { useInviteRater, useParticipant, useRemoveRater, useSubmitMyResponse } from "./hooks";
import { RATER_LABEL } from "./labels";
import type { CampaignCompetency, ParticipantDetail } from "./types";

/** Compact text summary of every submitted response, for the AI to reason over. */
function participantToPrompt(participant: ParticipantDetail): string {
  const name = fullName(participant.employee.firstName, participant.employee.lastName);
  const competencyName = (id: string) => participant.campaign.competencies.find((c) => c.competencyId === id)?.name ?? id;

  const sections = participant.fullResponses
    .filter((r) => r.status === "SUBMITTED")
    .map((r) => {
      const scoreLines = r.scores.map((s) => `- ${competencyName(s.competencyId)}: ${s.score.toFixed(1)}/5`).join("\n");
      return [
        `[${RATER_LABEL[r.raterType] ?? r.raterType}]`,
        scoreLines,
        r.strengths ? `จุดแข็ง: ${r.strengths}` : "",
        r.improvements ? `สิ่งที่ควรพัฒนา: ${r.improvements}` : "",
        r.summary ? `สรุป: ${r.summary}` : "",
      ].filter(Boolean).join("\n");
    });

  return [
    `นี่คือผลการประเมิน "${participant.campaign.name}" รอบ ${participant.campaign.cycle} ของพนักงาน ${name} จากระบบ GV One`,
    participant.overallScore != null ? `คะแนนรวมทางการ (จากหัวหน้างาน): ${participant.overallScore.toFixed(1)}/5 (${participant.band})` : "ยังไม่มีคะแนนรวมทางการ",
    "",
    ...sections,
    "",
    "ช่วยวิเคราะห์เชิงผู้บริหาร (3-5 bullet): จุดแข็งเด่น, สิ่งที่ควรพัฒนา, ความเห็นไม่ตรงกันระหว่างผู้ประเมิน (ถ้ามี), และข้อเสนอแนะเชิงปฏิบัติสำหรับหัวหน้างาน",
    "ตอบเป็นภาษาไทยกระชับ อ้างอิงข้อมูลจากที่ให้มาเท่านั้น ไม่ต้องเรียกเครื่องมือใด",
  ].join("\n");
}

export function ParticipantDetailView({ participantId }: { participantId: string }) {
  const { user, can } = useAuth();
  const myEmployeeId = user.employee?.id;
  const { data, isLoading, isError, refetch } = useParticipant(participantId);
  const submitMutation = useSubmitMyResponse(participantId);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [summary, setSummary] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");

  const participant = data?.data;

  const canManageRaters = can("campaign:approve") || (!!myEmployeeId && myEmployeeId === participant?.employee.managerId);

  const myResponse = participant?.fullResponses.find((r) => r.raterEmployeeId === myEmployeeId);
  const myRole = myResponse?.raterType ?? "OTHER";
  const selfResponse = participant?.fullResponses.find((r) => r.raterType === "SELF");
  const managerResponse = participant?.fullResponses.find((r) => r.raterType === "MANAGER");
  const peerResponses = participant?.fullResponses.filter((r) => r.raterType === "PEER") ?? [];
  const upwardResponses = participant?.fullResponses.filter((r) => r.raterType === "UPWARD") ?? [];

  useEffect(() => {
    if (!participant) return;
    if (participant.campaign.templateSnapshot) {
      const initial: Record<string, string> = {};
      for (const a of myResponse?.answers ?? []) initial[a.questionId] = a.value;
      setAnswers(initial);
    } else {
      const initial: Record<string, number> = {};
      for (const c of participant.campaign.competencies) {
        const existing = myResponse?.scores.find((s) => s.competencyId === c.competencyId);
        initial[c.competencyId] = existing?.score ?? 3;
      }
      setScores(initial);
    }
    setStrengths(myResponse?.strengths ?? "");
    setImprovements(myResponse?.improvements ?? "");
    setSummary(myResponse?.summary ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant?.id]);

  if (isLoading) return <p className="text-sm text-muted-foreground">กำลังโหลด…</p>;
  if (isError || !participant) return <p className="text-sm text-destructive">ไม่พบข้อมูล</p>;

  const canRespond = !!myResponse && myResponse.status !== "SUBMITTED";

  async function submit() {
    try {
      await submitMutation.mutateAsync(
        participant!.campaign.templateSnapshot
          ? {
              answers: Object.entries(answers).map(([questionId, value]) => ({ questionId, value })),
              strengths: strengths.trim() || undefined,
              improvements: improvements.trim() || undefined,
              summary: summary.trim() || undefined,
            }
          : {
              scores: Object.entries(scores).map(([competencyId, score]) => ({ competencyId, score })),
              strengths: strengths.trim() || undefined,
              improvements: improvements.trim() || undefined,
              summary: summary.trim() || undefined,
            },
      );
      toast.success("บันทึกแบบประเมินเรียบร้อย");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  const hasSubmittedResponses = participant.fullResponses.some((r) => r.status === "SUBMITTED");

  async function analyzeWithAi() {
    setAiOpen(true);
    setAiLoading(true);
    setAiText("");
    try {
      const prompt = participantToPrompt(participant!);
      const res = await sendChat([{ role: "user", content: prompt }]);
      setAiText(res.data.reply);
    } catch {
      setAiText("ขออภัย ไม่สามารถวิเคราะห์ผลประเมินได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <Link
            href={`/performance/campaigns/${participant.campaign.id}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" /> กลับไปแคมเปญ
          </Link>
          <h1 className="text-xl font-semibold text-foreground">
            {fullName(participant.employee.firstName, participant.employee.lastName)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {participant.campaign.name} · {participant.campaign.cycle}
          </p>
        </div>
        {canManageRaters && (
          <Button
            variant="outline"
            size="sm"
            onClick={analyzeWithAi}
            disabled={!hasSubmittedResponses}
            className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
          >
            <Sparkles className="size-4" /> AI วิเคราะห์ผลประเมิน
          </Button>
        )}
      </div>

      {participant.overallScore != null && (
        <Card className="gap-1 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground">คะแนนรวม (จากหัวหน้างาน)</p>
          <p className="text-2xl font-semibold text-foreground">
            {participant.overallScore.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">· {participant.band}</span>
          </p>
        </Card>
      )}

      {canRespond ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{ROLE_LABEL[myRole] ?? "แบบประเมิน"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {participant.campaign.templateSnapshot ? (
              <TemplateFormRenderer
                sections={participant.campaign.templateSnapshot.sections}
                mode="answer"
                answers={answers}
                onChange={(questionId, value) => setAnswers((prev) => ({ ...prev, [questionId]: value }))}
              />
            ) : (
              <div className="space-y-3">
                {groupByCategory(participant.campaign.competencies).map((group) => (
                  <div key={group.categoryId} className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground">{group.categoryName}</p>
                    {group.items.map((c) => (
                      <div key={c.competencyId} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{c.name}</p>
                          {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                          {c.exampleBehavior && (
                            <p className="text-xs text-muted-foreground">ตัวอย่างพฤติกรรม: {c.exampleBehavior}</p>
                          )}
                        </div>
                        <ScorePicker
                          value={scores[c.competencyId] ?? 3}
                          onChange={(v) => setScores((prev) => ({ ...prev, [c.competencyId]: v }))}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">จุดแข็ง</label>
              <Textarea rows={2} value={strengths} onChange={(e) => setStrengths(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">สิ่งที่ควรพัฒนา</label>
              <Textarea rows={2} value={improvements} onChange={(e) => setImprovements(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">สรุป</label>
              <Textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
            </div>
            <Button onClick={submit} disabled={submitMutation.isPending}>
              {submitMutation.isPending && <Loader2 className="size-4 animate-spin" />} ส่งแบบประเมิน
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {participant.campaign.raterTypes.includes("SELF") && (
          <ResponseCard
            title="ประเมินตนเอง"
            response={selfResponse}
            competencies={participant.campaign.competencies}
            templateSections={participant.campaign.templateSnapshot?.sections}
          />
        )}
        {participant.campaign.raterTypes.includes("MANAGER") && (
          <ResponseCard
            title="ประเมินโดยหัวหน้างาน"
            response={managerResponse}
            competencies={participant.campaign.competencies}
            templateSections={participant.campaign.templateSnapshot?.sections}
          />
        )}
        {peerResponses.map((r) => (
          <ResponseCard
            key={r.id}
            title="ประเมินโดยเพื่อนร่วมงาน"
            response={r}
            competencies={participant.campaign.competencies}
            templateSections={participant.campaign.templateSnapshot?.sections}
            removable={canManageRaters && r.status === "PENDING"}
          />
        ))}
        {upwardResponses.map((r) => (
          <ResponseCard
            key={r.id}
            title="ประเมินโดยผู้ใต้บังคับบัญชา"
            response={r}
            competencies={participant.campaign.competencies}
            templateSections={participant.campaign.templateSnapshot?.sections}
            removable={canManageRaters && r.status === "PENDING"}
          />
        ))}
      </div>

      {canManageRaters && (participant.campaign.raterTypes.includes("PEER") || participant.campaign.raterTypes.includes("UPWARD")) && (
        <InviteRaterCard
          participantId={participant.id}
          employeeId={participant.employee.id}
          raterTypes={participant.campaign.raterTypes}
        />
      )}

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="size-4 text-primary" />
              </span>
              AI วิเคราะห์ผลประเมิน · {fullName(participant.employee.firstName, participant.employee.lastName)}
            </DialogTitle>
            <DialogDescription>วิเคราะห์โดย AI Assistant จากคะแนน/ความเห็นที่ส่งเข้ามาแล้วเท่านั้น</DialogDescription>
          </DialogHeader>
          {aiLoading ? (
            <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary" />
              กำลังวิเคราะห์ผลประเมิน...
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {aiText}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  SELF: "แบบประเมินตนเอง",
  MANAGER: "แบบประเมินโดยหัวหน้างาน",
  PEER: "แบบประเมินโดยเพื่อนร่วมงาน",
  UPWARD: "แบบประเมินโดยผู้ใต้บังคับบัญชา",
};

function InviteRaterCard({
  participantId,
  employeeId,
  raterTypes,
}: {
  participantId: string;
  employeeId: string;
  raterTypes: string[];
}) {
  const [open, setOpen] = useState(false);
  const [raterType, setRaterType] = useState<"PEER" | "UPWARD">(raterTypes.includes("PEER") ? "PEER" : "UPWARD");
  const [raterId, setRaterId] = useState("");
  const { data: orgData } = useOrgOptions();
  const inviteMutation = useInviteRater(participantId);

  const candidates =
    raterType === "UPWARD"
      ? (orgData?.data.managers ?? []).filter((e) => e.managerId === employeeId)
      : (orgData?.data.managers ?? []).filter((e) => e.id !== employeeId);

  async function submit() {
    if (!raterId) {
      toast.error("กรุณาเลือกพนักงาน");
      return;
    }
    try {
      await inviteMutation.mutateAsync({ raterType, raterEmployeeId: raterId });
      toast.success("เชิญผู้ประเมินแล้ว");
      setOpen(false);
      setRaterId("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เชิญไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> เชิญผู้ประเมินเพิ่มเติม
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>เชิญผู้ประเมินเพิ่มเติม</DialogTitle>
          <DialogDescription>เลือกประเภทและพนักงานที่จะเชิญให้ร่วมประเมิน</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {raterTypes.includes("PEER") && raterTypes.includes("UPWARD") && (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={raterType === "PEER" ? "default" : "outline"}
                onClick={() => {
                  setRaterType("PEER");
                  setRaterId("");
                }}
              >
                เพื่อนร่วมงาน
              </Button>
              <Button
                type="button"
                size="sm"
                variant={raterType === "UPWARD" ? "default" : "outline"}
                onClick={() => {
                  setRaterType("UPWARD");
                  setRaterId("");
                }}
              >
                ผู้ใต้บังคับบัญชา
              </Button>
            </div>
          )}
          <Select value={raterId} onValueChange={(v) => setRaterId(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกพนักงาน" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} ({c.employeeCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="w-full" onClick={submit} disabled={inviteMutation.isPending}>
            เชิญ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResponseCard({
  title,
  response,
  competencies,
  templateSections,
  removable,
}: {
  title: string;
  response?: {
    id?: string;
    status: string;
    scores: { competencyId: string; score: number }[];
    answers?: { questionId: string; value: string }[] | null;
    strengths: string | null;
    improvements: string | null;
    summary: string | null;
    submittedAt: string | null;
  };
  competencies: CampaignCompetency[];
  templateSections?: TemplateSection[];
  removable?: boolean;
}) {
  const removeMutation = useRemoveRater();

  async function remove() {
    if (!response?.id) return;
    try {
      await removeMutation.mutateAsync(response.id);
      toast.success("ยกเลิกผู้ประเมินแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ยกเลิกไม่สำเร็จ");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          {title}
          <span className="flex items-center gap-2">
            {response?.status === "SUBMITTED" && <CheckCircle2 className="size-4 text-success" />}
            {removable && (
              <button
                onClick={remove}
                disabled={removeMutation.isPending}
                aria-label="ยกเลิกผู้ประเมิน"
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-4" />
              </button>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!response || response.status !== "SUBMITTED" ? (
          <p className="text-muted-foreground">ยังไม่ได้ส่งแบบประเมิน</p>
        ) : templateSections ? (
          <>
            {templateSections.flatMap((s) => s.questions).map((q) => {
              const a = response.answers?.find((x) => x.questionId === q.id);
              const label = q.answerType === "LONG_TEXT" ? a?.value : q.options?.find((o) => o.value === a?.value)?.label;
              return (
                <div key={q.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-muted-foreground">{q.text}</span>
                  <span className="shrink-0 max-w-[50%] truncate text-right font-medium text-foreground">{label ?? "-"}</span>
                </div>
              );
            })}
            {response.summary && (
              <p className="mt-2 border-t border-border pt-2 text-muted-foreground">{response.summary}</p>
            )}
          </>
        ) : (
          <>
            {groupByCategory(competencies).map((group) => (
              <div key={group.categoryId} className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">{group.categoryName}</p>
                {group.items.map((c) => {
                  const s = response.scores.find((x) => x.competencyId === c.competencyId);
                  return (
                    <div key={c.competencyId} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-muted-foreground">{c.name}</span>
                      <span className="shrink-0 font-medium text-foreground">{s?.score.toFixed(1) ?? "-"}</span>
                    </div>
                  );
                })}
              </div>
            ))}
            {response.summary && (
              <p className="mt-2 border-t border-border pt-2 text-muted-foreground">{response.summary}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
