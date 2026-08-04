"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fullName } from "@/lib/format";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/features/auth/auth-context";
import { useOrgOptions } from "@/features/employee/hooks";
import { groupByCategory } from "@/lib/competency-grouping";
import { useInviteRater, useParticipant, useRemoveRater, useSubmitMyResponse } from "./hooks";
import type { CampaignCompetency } from "./types";

export function ParticipantDetailView({ participantId }: { participantId: string }) {
  const { user, can } = useAuth();
  const myEmployeeId = user.employee?.id;
  const { data, isLoading, isError, refetch } = useParticipant(participantId);
  const submitMutation = useSubmitMyResponse(participantId);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [summary, setSummary] = useState("");

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

  const canRespond = !!myResponse && myResponse.status !== "SUBMITTED";

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
            <CardTitle className="text-base">{ROLE_LABEL[myRole] ?? "แบบประเมิน"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {groupByCategory(participant.campaign.competencies).map((group) => (
                <div key={group.categoryId} className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">{group.categoryName}</p>
                  {group.items.map((c) => (
                    <div key={c.competencyId} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                        {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                        {c.exampleBehavior && (
                          <p className="text-xs text-muted-foreground">ตัวอย่างพฤติกรรม: {c.exampleBehavior}</p>
                        )}
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
        {participant.campaign.raterTypes.includes("SELF") && (
          <ResponseCard title="ประเมินตนเอง" response={selfResponse} competencies={participant.campaign.competencies} />
        )}
        {participant.campaign.raterTypes.includes("MANAGER") && (
          <ResponseCard title="ประเมินโดยหัวหน้างาน" response={managerResponse} competencies={participant.campaign.competencies} />
        )}
        {peerResponses.map((r) => (
          <ResponseCard
            key={r.id}
            title="ประเมินโดยเพื่อนร่วมงาน"
            response={r}
            competencies={participant.campaign.competencies}
            removable={canManageRaters && r.status === "PENDING"}
          />
        ))}
        {upwardResponses.map((r) => (
          <ResponseCard
            key={r.id}
            title="ประเมินโดยผู้ใต้บังคับบัญชา"
            response={r}
            competencies={participant.campaign.competencies}
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
  removable,
}: {
  title: string;
  response?: {
    id?: string;
    status: string;
    scores: { competencyId: string; score: number }[];
    strengths: string | null;
    improvements: string | null;
    summary: string | null;
    submittedAt: string | null;
  };
  competencies: CampaignCompetency[];
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
