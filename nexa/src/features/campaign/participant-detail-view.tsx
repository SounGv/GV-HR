"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fullName } from "@/lib/format";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/features/auth/auth-context";
import { useParticipant, useSubmitMyResponse } from "./hooks";

export function ParticipantDetailView({ participantId }: { participantId: string }) {
  const { user } = useAuth();
  const myEmployeeId = user.employee?.id;
  const { data, isLoading, isError, refetch } = useParticipant(participantId);
  const submitMutation = useSubmitMyResponse(participantId);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [summary, setSummary] = useState("");

  const participant = data?.data;

  const myRole: "SELF" | "MANAGER" | "OTHER" = participant
    ? myEmployeeId === participant.employee.id
      ? "SELF"
      : myEmployeeId === participant.employee.managerId
        ? "MANAGER"
        : "OTHER"
    : "OTHER";

  const myResponse = participant?.fullResponses.find((r) => r.raterType === myRole);
  const selfResponse = participant?.fullResponses.find((r) => r.raterType === "SELF");
  const managerResponse = participant?.fullResponses.find((r) => r.raterType === "MANAGER");

  useEffect(() => {
    if (!participant) return;
    const initial: Record<string, number> = {};
    for (const c of participant.campaign.competencies) {
      const existing = myResponse?.scores.find((s) => s.competencyId === c.competencyId);
      initial[c.competencyId] = existing?.score ?? 3;
    }
    setScores(initial);
    setStrengths(myResponse?.strengths ?? "");
    setImprovements(myResponse?.improvements ?? "");
    setSummary(myResponse?.summary ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant?.id]);

  if (isLoading) return <p className="text-sm text-muted-foreground">กำลังโหลด…</p>;
  if (isError || !participant) return <p className="text-sm text-destructive">ไม่พบข้อมูล</p>;

  const canRespond = (myRole === "SELF" || myRole === "MANAGER") && myResponse?.status !== "SUBMITTED";

  async function submit() {
    try {
      await submitMutation.mutateAsync({
        scores: Object.entries(scores).map(([competencyId, score]) => ({ competencyId, score })),
        strengths: strengths.trim() || undefined,
        improvements: improvements.trim() || undefined,
        summary: summary.trim() || undefined,
      });
      toast.success("บันทึกแบบประเมินเรียบร้อย");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-6">
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
            <CardTitle className="text-base">
              {myRole === "SELF" ? "แบบประเมินตนเอง" : "แบบประเมินโดยหัวหน้างาน"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {participant.campaign.competencies.map((c) => (
                <div key={c.competencyId} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    step={0.5}
                    className="w-20 shrink-0"
                    value={scores[c.competencyId] ?? 3}
                    onChange={(e) =>
                      setScores((prev) => ({ ...prev, [c.competencyId]: Number(e.target.value) || 1 }))
                    }
                  />
                </div>
              ))}
            </div>
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
        <ResponseCard title="ประเมินตนเอง" response={selfResponse} competencies={participant.campaign.competencies} />
        <ResponseCard title="ประเมินโดยหัวหน้างาน" response={managerResponse} competencies={participant.campaign.competencies} />
      </div>
    </div>
  );
}

function ResponseCard({
  title,
  response,
  competencies,
}: {
  title: string;
  response?: {
    status: string;
    scores: { competencyId: string; score: number }[];
    strengths: string | null;
    improvements: string | null;
    summary: string | null;
    submittedAt: string | null;
  };
  competencies: { competencyId: string; name: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          {title}
          {response?.status === "SUBMITTED" && <CheckCircle2 className="size-4 text-success" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {!response || response.status !== "SUBMITTED" ? (
          <p className="text-muted-foreground">ยังไม่ได้ส่งแบบประเมิน</p>
        ) : (
          <>
            {competencies.map((c) => {
              const s = response.scores.find((x) => x.competencyId === c.competencyId);
              return (
                <div key={c.competencyId} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="font-medium text-foreground">{s?.score.toFixed(1) ?? "-"}</span>
                </div>
              );
            })}
            {response.summary && (
              <p className="mt-2 border-t border-border pt-2 text-muted-foreground">{response.summary}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
