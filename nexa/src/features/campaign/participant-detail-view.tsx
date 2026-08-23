"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, FileText, Loader2, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScorePicker } from "@/components/shared/score-picker";
import { FileAttachField } from "@/components/shared/file-attach-field";
import { TemplateFormRenderer } from "@/features/evaluation-template/template-renderer";
import type { TemplateSection, TemplateVisibleToType } from "@/features/evaluation-template/types";
import { fullName, getInitials } from "@/lib/format";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/features/auth/auth-context";
import { useOrgOptions } from "@/features/employee/hooks";
import { sendChat } from "@/features/ai/api";
import { groupByCategory } from "@/lib/competency-grouping";
import {
  useAcknowledgeResult,
  useApproveReopen,
  useInviteRater,
  useParticipant,
  useRemoveRater,
  useRequestReopen,
  useSaveDraftResponse,
  useSubmitMyResponse,
} from "./hooks";
import { RATER_LABEL } from "./labels";
import type { CampaignCompetency, ParticipantDetail, ScoreStatus } from "./types";

const SCORE_STATUS_LABEL: Record<ScoreStatus, string> = {
  GOOD: "ดี/ดีเยี่ยม",
  NEEDS_IMPROVEMENT: "มีบางจุดต้องปรับปรุง",
  WATCH: "ต้องติดตาม",
  URGENT: "ต้องแก้ไขเร่งด่วน",
};

const SCORE_STATUS_CLASS: Record<ScoreStatus, string> = {
  GOOD: "bg-success/10 text-success",
  NEEDS_IMPROVEMENT: "bg-warning/10 text-warning",
  WATCH: "bg-warning/10 text-warning",
  URGENT: "bg-destructive/10 text-destructive",
};

/** Per requirement 7's wording rule — never a harsh phrase like "ทำงานแย่". */
const SCORE_STATUS_MESSAGE: Record<ScoreStatus, string> = {
  GOOD: "ผลงานอยู่ในเกณฑ์ดี",
  NEEDS_IMPROVEMENT: "มีบางหัวข้อที่ควรพัฒนาเพิ่มเติม หัวหน้าจะช่วยวางแผนปรับปรุงร่วมกัน",
  WATCH: "ควรติดตามผลอย่างใกล้ชิดในรอบถัดไป",
  URGENT: "มีบางหัวข้อที่ควรพัฒนาเพิ่มเติม หัวหน้าจะช่วยวางแผนปรับปรุงร่วมกัน — ระบบสร้างแผนพัฒนาให้อัตโนมัติแล้ว",
};

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
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");

  const participant = data?.data;
  const saveDraftMutation = useSaveDraftResponse(participantId);
  const acknowledgeMutation = useAcknowledgeResult();
  const requestReopenMutation = useRequestReopen();
  const approveReopenMutation = useApproveReopen();
  const [reopenTarget, setReopenTarget] = useState<{ responseId: string; note: string } | null>(null);

  const canManageRaters = can("campaign:approve") || (!!myEmployeeId && myEmployeeId === participant?.employee.managerId);

  const myResponse = participant?.fullResponses.find((r) => r.raterEmployeeId === myEmployeeId);
  const myRole = myResponse?.raterType ?? "OTHER";
  const selfResponse = participant?.fullResponses.find((r) => r.raterType === "SELF");
  const managerResponse = participant?.fullResponses.find((r) => r.raterType === "MANAGER");
  const peerResponses = participant?.fullResponses.filter((r) => r.raterType === "PEER") ?? [];
  const upwardResponses = participant?.fullResponses.filter((r) => r.raterType === "UPWARD") ?? [];
  const hrExecResponses = participant?.fullResponses.filter((r) => r.raterType === "HR_EXEC") ?? [];

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
    setEvidenceUrls(myResponse?.evidenceUrls ?? []);
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
              evidenceUrls: evidenceUrls.length > 0 ? evidenceUrls : undefined,
            }
          : {
              scores: Object.entries(scores).map(([competencyId, score]) => ({ competencyId, score })),
              strengths: strengths.trim() || undefined,
              improvements: improvements.trim() || undefined,
              summary: summary.trim() || undefined,
              evidenceUrls: evidenceUrls.length > 0 ? evidenceUrls : undefined,
            },
      );
      toast.success("บันทึกแบบประเมินเรียบร้อย");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  async function saveDraft() {
    try {
      await saveDraftMutation.mutateAsync(
        participant!.campaign.templateSnapshot
          ? { answers: Object.entries(answers).map(([questionId, value]) => ({ questionId, value })) }
          : { scores: Object.entries(scores).map(([competencyId, score]) => ({ competencyId, score })) },
      );
      toast.success("บันทึกแบบร่างแล้ว — กลับมาทำต่อได้ทีหลัง");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกแบบร่างไม่สำเร็จ");
    }
  }

  async function acknowledge() {
    try {
      await acknowledgeMutation.mutateAsync(participantId);
      toast.success("รับทราบผลการประเมินแล้ว");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "รับทราบไม่สำเร็จ");
    }
  }

  async function submitReopenRequest() {
    if (!reopenTarget) return;
    try {
      await requestReopenMutation.mutateAsync({ responseId: reopenTarget.responseId, note: reopenTarget.note });
      toast.success("ส่งคำขอเปิดแก้ไขใหม่แล้ว — รอ HR อนุมัติ");
      setReopenTarget(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ส่งคำขอไม่สำเร็จ");
    }
  }

  async function approveReopen(responseId: string) {
    try {
      await approveReopenMutation.mutateAsync(responseId);
      toast.success("เปิดแก้ไขใหม่แล้ว");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "อนุมัติไม่สำเร็จ");
    }
  }

  const hasSubmittedResponses = participant.fullResponses.some((r) => r.status === "SUBMITTED");
  const canAcknowledge =
    !!myEmployeeId && myEmployeeId === participant.employee.id && !!participant.finalizedAt && !participant.employeeAcknowledged;

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

      {participant.scorePercent != null && (
        <Card className="gap-2 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">คะแนนรวม (ถ่วงน้ำหนัก)</p>
              <p className="text-2xl font-semibold text-foreground">
                {participant.scorePercent.toFixed(1)}%
                {participant.rawScore != null && participant.maxScore != null && (
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                    ({participant.rawScore.toFixed(1)}/{participant.maxScore.toFixed(1)} คะแนนดิบ · {participant.questionCount} ข้อ · ผู้ประเมิน {participant.evaluatorCount} คน)
                  </span>
                )}
              </p>
            </div>
            {participant.scoreStatus && (
              <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${SCORE_STATUS_CLASS[participant.scoreStatus]}`}>
                {SCORE_STATUS_LABEL[participant.scoreStatus]}
              </span>
            )}
          </div>
          {participant.scoreStatus && participant.scoreStatus !== "GOOD" && (
            <p className="text-sm text-muted-foreground">{SCORE_STATUS_MESSAGE[participant.scoreStatus]}</p>
          )}
          {participant.lowestTopics && participant.lowestTopics.length > 0 && participant.scoreStatus !== "GOOD" && (
            <div className="mt-1 space-y-1 border-t border-border pt-2">
              <p className="text-xs font-medium text-muted-foreground">หัวข้อที่คะแนนต่ำสุด</p>
              {participant.lowestTopics.map((t) => (
                <div key={t.key} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t.label}</span>
                  <span className="font-medium text-foreground">{t.score}/{t.maxScore}</span>
                </div>
              ))}
            </div>
          )}
          {participant.finalizedAt && (
            <div className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-2">
              <span className="text-sm text-muted-foreground">
                {participant.employeeAcknowledged ? "พนักงานรับทราบผลแล้ว" : "รอพนักงานรับทราบผล"}
              </span>
              {canAcknowledge && (
                <Button size="sm" onClick={acknowledge} disabled={acknowledgeMutation.isPending}>
                  {acknowledgeMutation.isPending && <Loader2 className="size-4 animate-spin" />} รับทราบผลการประเมิน
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {canRespond ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{ROLE_LABEL[myRole] ?? "แบบประเมิน"}</CardTitle>
            {participant.campaign.templateSnapshot && (
              <TemplateProgress
                sections={participant.campaign.templateSnapshot.sections}
                answers={answers}
                viewerRaterType={myResponse?.raterType}
              />
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {participant.campaign.templateSnapshot ? (
              <TemplateFormRenderer
                sections={participant.campaign.templateSnapshot.sections}
                mode="answer"
                answers={answers}
                onChange={(questionId, value) => setAnswers((prev) => ({ ...prev, [questionId]: value }))}
                viewerRaterType={myResponse?.raterType}
              />
            ) : (
              <div className="space-y-3">
                {groupByCategory(participant.campaign.competencies).map((group) => (
                  <div key={group.categoryId} className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground">{group.categoryName}</p>
                    {group.items.map((c) => (
                      <div key={c.competencyId} className="flex flex-col gap-2.5 rounded-lg border border-border p-3.5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-foreground">{c.name}</p>
                          {c.description && <p className="mt-0.5 text-sm text-muted-foreground">{c.description}</p>}
                          {c.exampleBehavior && (
                            <p className="mt-0.5 text-sm text-muted-foreground">ตัวอย่างพฤติกรรม: {c.exampleBehavior}</p>
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
              <label className="text-base font-medium text-foreground">จุดแข็ง</label>
              <Textarea rows={2} value={strengths} onChange={(e) => setStrengths(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-base font-medium text-foreground">สิ่งที่ควรพัฒนา</label>
              <Textarea rows={2} value={improvements} onChange={(e) => setImprovements(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-base font-medium text-foreground">สรุป</label>
              <Textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-base font-medium text-foreground">แนบหลักฐาน (ไม่บังคับ)</label>
              <div className="space-y-2">
                {evidenceUrls.map((url, i) => (
                  <FileAttachField
                    key={i}
                    value={url}
                    maxBytes={2_000_000}
                    onChange={(dataUrl) => {
                      const next = [...evidenceUrls];
                      if (dataUrl) next[i] = dataUrl;
                      else next.splice(i, 1);
                      setEvidenceUrls(next);
                    }}
                  />
                ))}
                {evidenceUrls.length < 3 && (
                  <FileAttachField
                    key={evidenceUrls.length}
                    maxBytes={2_000_000}
                    onChange={(dataUrl) => dataUrl && setEvidenceUrls([...evidenceUrls, dataUrl])}
                  />
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                className="shrink-0"
                onClick={saveDraft}
                disabled={saveDraftMutation.isPending || submitMutation.isPending}
              >
                {saveDraftMutation.isPending && <Loader2 className="size-4 animate-spin" />} บันทึกแบบร่าง
              </Button>
              <Button size="lg" className="flex-1" onClick={submit} disabled={submitMutation.isPending}>
                {submitMutation.isPending && <Loader2 className="size-4 animate-spin" />} ส่งแบบประเมิน
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              กดยืนยันก่อนส่ง — หลังส่งแล้วจะแก้ไขไม่ได้ ต้องขอเปิดแก้ไขใหม่ผ่าน HR
            </p>
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
            myEmployeeId={myEmployeeId}
            canApproveReopen={canManageRaters}
            onRequestReopen={(responseId) => setReopenTarget({ responseId, note: "" })}
            onApproveReopen={approveReopen}
          />
        )}
        {participant.campaign.raterTypes.includes("MANAGER") && (
          <ResponseCard
            title="ประเมินโดยหัวหน้างาน"
            response={managerResponse}
            competencies={participant.campaign.competencies}
            templateSections={participant.campaign.templateSnapshot?.sections}
            myEmployeeId={myEmployeeId}
            canApproveReopen={canManageRaters}
            onRequestReopen={(responseId) => setReopenTarget({ responseId, note: "" })}
            onApproveReopen={approveReopen}
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
            myEmployeeId={myEmployeeId}
            canApproveReopen={canManageRaters}
            onRequestReopen={(responseId) => setReopenTarget({ responseId, note: "" })}
            onApproveReopen={approveReopen}
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
            myEmployeeId={myEmployeeId}
            canApproveReopen={canManageRaters}
            onRequestReopen={(responseId) => setReopenTarget({ responseId, note: "" })}
            onApproveReopen={approveReopen}
          />
        ))}
        {hrExecResponses.map((r) => (
          <ResponseCard
            key={r.id}
            title="ประเมินโดย HR / ผู้บริหาร"
            response={r}
            competencies={participant.campaign.competencies}
            templateSections={participant.campaign.templateSnapshot?.sections}
            removable={canManageRaters && r.status === "PENDING"}
            myEmployeeId={myEmployeeId}
            canApproveReopen={canManageRaters}
            onRequestReopen={(responseId) => setReopenTarget({ responseId, note: "" })}
            onApproveReopen={approveReopen}
          />
        ))}
      </div>

      <Dialog open={!!reopenTarget} onOpenChange={(open) => !open && setReopenTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ขอเปิดแก้ไขแบบประเมินใหม่</DialogTitle>
            <DialogDescription>ระบุเหตุผล — HR จะเป็นผู้พิจารณาอนุมัติ</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            placeholder="เหตุผลที่ต้องการแก้ไข"
            value={reopenTarget?.note ?? ""}
            onChange={(e) => setReopenTarget((prev) => (prev ? { ...prev, note: e.target.value } : prev))}
          />
          <Button className="w-full" onClick={submitReopenRequest} disabled={requestReopenMutation.isPending || !reopenTarget?.note.trim()}>
            {requestReopenMutation.isPending && <Loader2 className="size-4 animate-spin" />} ส่งคำขอ
          </Button>
        </DialogContent>
      </Dialog>

      {canManageRaters &&
        (participant.campaign.raterTypes.includes("PEER") ||
          participant.campaign.raterTypes.includes("UPWARD") ||
          participant.campaign.raterTypes.includes("HR_EXEC")) && (
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
  HR_EXEC: "แบบประเมินโดย HR / ผู้บริหาร",
};

/** Live "answered N of M" progress as the rater fills in the form, before submit. */
function TemplateProgress({
  sections,
  answers,
  viewerRaterType,
}: {
  sections: TemplateSection[];
  answers: Record<string, string>;
  viewerRaterType?: TemplateVisibleToType;
}) {
  const questions = sections
    .flatMap((s) => s.questions)
    .filter((q) => q.visibleTo.length === 0 || (!!viewerRaterType && q.visibleTo.includes(viewerRaterType)));
  const total = questions.length;
  const answered = questions.filter((q) => (answers[q.id] ?? "").trim() !== "").length;
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {pct}% กรอกไปแล้ว · {answered} จาก {total} หัวข้อ
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const INVITABLE_TYPES: { value: "PEER" | "UPWARD" | "HR_EXEC"; label: string }[] = [
  { value: "PEER", label: "เพื่อนร่วมงาน" },
  { value: "UPWARD", label: "ผู้ใต้บังคับบัญชา" },
  { value: "HR_EXEC", label: "HR / ผู้บริหาร" },
];

function InviteRaterCard({
  participantId,
  employeeId,
  raterTypes,
}: {
  participantId: string;
  employeeId: string;
  raterTypes: string[];
}) {
  const invitableTypes = INVITABLE_TYPES.filter((t) => raterTypes.includes(t.value));
  const [open, setOpen] = useState(false);
  const [raterType, setRaterType] = useState<"PEER" | "UPWARD" | "HR_EXEC">(invitableTypes[0]?.value ?? "PEER");
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
          {invitableTypes.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {invitableTypes.map((t) => (
                <Button
                  key={t.value}
                  type="button"
                  size="sm"
                  variant={raterType === t.value ? "default" : "outline"}
                  onClick={() => {
                    setRaterType(t.value);
                    setRaterId("");
                  }}
                >
                  {t.label}
                </Button>
              ))}
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
  myEmployeeId,
  canApproveReopen,
  onRequestReopen,
  onApproveReopen,
}: {
  title: string;
  response?: {
    id?: string;
    status: string;
    raterType?: string;
    raterEmployeeId?: string;
    reopenRequested?: boolean;
    reopenRequestNote?: string | null;
    scores: { competencyId: string; score: number }[];
    answers?: { questionId: string; value: string }[] | null;
    strengths: string | null;
    improvements: string | null;
    summary: string | null;
    evidenceUrls?: string[] | null;
    submittedAt: string | null;
    raterEmployee?: { firstName: string; lastName: string; avatarUrl: string | null } | null;
  };
  competencies: CampaignCompetency[];
  templateSections?: TemplateSection[];
  removable?: boolean;
  myEmployeeId?: string;
  canApproveReopen?: boolean;
  onRequestReopen?: (responseId: string) => void;
  onApproveReopen?: (responseId: string) => void;
}) {
  const removeMutation = useRemoveRater();
  const raterName = response?.raterEmployee ? fullName(response.raterEmployee.firstName, response.raterEmployee.lastName) : null;
  const isMyResponse = !!response?.raterEmployeeId && response.raterEmployeeId === myEmployeeId;

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
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar className="size-9 shrink-0">
              {response?.raterEmployee?.avatarUrl && (
                <AvatarImage src={response.raterEmployee.avatarUrl} alt={raterName ?? ""} />
              )}
              <AvatarFallback className="bg-primary/10 text-sm text-primary">
                {raterName ? getInitials(response!.raterEmployee!.firstName, response!.raterEmployee!.lastName) : "?"}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold text-foreground">{raterName ?? title}</span>
              <span className="block text-sm font-normal text-muted-foreground">{title}</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {response?.status === "SUBMITTED" && <CheckCircle2 className="size-5 text-success" />}
            {removable && (
              <button
                onClick={remove}
                disabled={removeMutation.isPending}
                aria-label="ยกเลิกผู้ประเมิน"
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-5" />
              </button>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-base">
        {!response || response.status !== "SUBMITTED" ? (
          <p className="text-sm text-muted-foreground">ยังไม่ได้ส่งแบบประเมิน</p>
        ) : templateSections ? (
          <>
            {templateSections
              .flatMap((s) => s.questions)
              .filter((q) => q.visibleTo.length === 0 || (!!response.raterType && q.visibleTo.includes(response.raterType as TemplateVisibleToType)))
              .map((q) => {
                const a = response.answers?.find((x) => x.questionId === q.id);
                const label = q.answerType === "LONG_TEXT" ? a?.value : q.options?.find((o) => o.value === a?.value)?.label;
                return (
                  <div key={q.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm text-muted-foreground">{q.text}</span>
                    <span className="shrink-0 max-w-[50%] truncate text-right font-semibold text-foreground">{label ?? "-"}</span>
                  </div>
                );
              })}
            {response.summary && (
              <p className="mt-2 border-t border-border pt-2 text-sm text-muted-foreground">{response.summary}</p>
            )}
          </>
        ) : (
          <>
            {groupByCategory(competencies).map((group) => (
              <div key={group.categoryId} className="space-y-1">
                <p className="text-sm font-semibold text-muted-foreground">{group.categoryName}</p>
                {group.items.map((c) => {
                  const s = response.scores.find((x) => x.competencyId === c.competencyId);
                  return (
                    <div key={c.competencyId} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm text-muted-foreground">{c.name}</span>
                      <span className="shrink-0 font-semibold text-foreground">{s?.score.toFixed(1) ?? "-"}</span>
                    </div>
                  );
                })}
              </div>
            ))}
            {response.summary && (
              <p className="mt-2 border-t border-border pt-2 text-sm text-muted-foreground">{response.summary}</p>
            )}
          </>
        )}
        {response?.status === "SUBMITTED" && response.evidenceUrls && response.evidenceUrls.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 border-t border-border pt-2">
            {response.evidenceUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/70"
              >
                <FileText className="size-3.5" /> หลักฐาน {i + 1}
              </a>
            ))}
          </div>
        )}
        {response?.status === "SUBMITTED" && response.id && (
          <div className="mt-2 border-t border-border pt-2">
            {response.reopenRequested ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-warning">
                  ขอเปิดแก้ไขใหม่: {response.reopenRequestNote ?? "-"}
                </p>
                {canApproveReopen && (
                  <Button size="sm" variant="outline" onClick={() => onApproveReopen?.(response.id!)}>
                    อนุมัติเปิดแก้ไข
                  </Button>
                )}
              </div>
            ) : (
              isMyResponse && (
                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => onRequestReopen?.(response.id!)}>
                  ขอเปิดแก้ไขใหม่
                </Button>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
