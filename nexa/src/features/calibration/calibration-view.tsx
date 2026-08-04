"use client";

import { useState } from "react";
import { ChevronLeft, Plus, Scale, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { useAuth } from "@/features/auth/auth-context";
import { useCampaigns } from "@/features/campaign/hooks";
import { ApiError } from "@/lib/api/client";
import { fullName } from "@/lib/format";
import { bandTone } from "@/lib/scoring";
import { cn } from "@/lib/utils";

import {
  useCalibrationSessions,
  useCalibrationSession,
  useCreateCalibrationSession,
  useUpdateParticipantCalibration,
  useCompleteCalibrationSession,
} from "./hooks";
import type { CalibrationParticipant, PotentialLevel } from "./types";

const POTENTIAL_LABEL: Record<PotentialLevel, string> = { LOW: "ต่ำ", MEDIUM: "ปานกลาง", HIGH: "สูง" };
const STATUS_LABEL: Record<string, string> = { DRAFT: "กำลังดำเนินการ", COMPLETED: "เสร็จสิ้น" };
const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  COMPLETED: "bg-success/10 text-success",
};

function toneClass(tone: ReturnType<typeof bandTone>) {
  return {
    success: "bg-success/10 text-success",
    info: "bg-info/10 text-info",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
  }[tone];
}

export function CalibrationView() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (selectedId) {
    return <SessionDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  }
  return <SessionList onSelect={setSelectedId} />;
}

function SessionList({ onSelect }: { onSelect: (id: string) => void }) {
  const { can } = useAuth();
  const canCreate = can("calibration:create");
  const { data, isLoading, isError, refetch } = useCalibrationSessions();
  const sessions = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">ประชุมปรับเทียบผลประเมินและกำหนดศักยภาพของพนักงาน</p>
        {canCreate && <CreateSessionDialog />}
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={3} />
      ) : sessions.length === 0 ? (
        <EmptyState icon={Scale} title="ยังไม่มีรอบปรับเทียบ" description={canCreate ? "สร้างรอบแรกจากแคมเปญที่สรุปผลแล้ว" : "ยังไม่มีข้อมูล"} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {sessions.map((s) => (
            <Card
              key={s.id}
              className="cursor-pointer gap-2 p-4 transition hover:border-primary/40 hover:shadow-sm"
              onClick={() => onSelect(s.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{s.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.campaign.name} · {s.campaign.cycle}
                  </p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[s.status])}>
                  {STATUS_LABEL[s.status]}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">ผู้เข้าร่วม {s.participantCount} คน</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateSessionDialog() {
  const [open, setOpen] = useState(false);
  const [campaignId, setCampaignId] = useState("");
  const [name, setName] = useState("");
  const { data: campaignData } = useCampaigns();
  const campaigns = campaignData?.data ?? [];
  const createMut = useCreateCalibrationSession();

  async function submit() {
    if (!campaignId || !name.trim()) {
      toast.error("กรุณาเลือกแคมเปญและระบุชื่อรอบ");
      return;
    }
    try {
      await createMut.mutateAsync({ campaignId, name: name.trim() });
      toast.success("สร้างรอบปรับเทียบแล้ว");
      setOpen(false);
      setCampaignId("");
      setName("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "สร้างไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> สร้างรอบปรับเทียบ
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>สร้างรอบปรับเทียบ</DialogTitle>
          <DialogDescription>ดึงผู้เข้าร่วมที่สรุปผลแล้วจากแคมเปญที่เลือกมาปรับเทียบคะแนนและกำหนดศักยภาพ</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={campaignId} onValueChange={(v) => setCampaignId(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกแคมเปญ" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.cycle})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="ชื่อรอบปรับเทียบ" value={name} onChange={(e) => setName(e.target.value)} />
          <Button className="w-full" onClick={submit} disabled={createMut.isPending}>
            สร้าง
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SessionDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { can } = useAuth();
  const canApprove = can("calibration:approve");
  const { data, isLoading, isError, refetch } = useCalibrationSession(id);
  const completeMut = useCompleteCalibrationSession();
  const session = data?.data;

  async function complete() {
    try {
      await completeMut.mutateAsync(id);
      toast.success("ปิดรอบปรับเทียบแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !session) return <TableLoadingState rows={4} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> กลับ
        </button>
        {canApprove && session.status === "DRAFT" && (
          <Button size="sm" onClick={complete} disabled={completeMut.isPending}>
            <CheckCircle2 className="size-4" /> ปิดรอบปรับเทียบ
          </Button>
        )}
      </div>

      <Card className="gap-1 p-4">
        <p className="font-medium text-foreground">{session.name}</p>
        <p className="text-xs text-muted-foreground">
          {session.campaign.name} · {session.campaign.cycle}
        </p>
      </Card>

      {session.participants.length === 0 ? (
        <EmptyState icon={Scale} title="ยังไม่มีผู้เข้าร่วม" />
      ) : (
        <div className="space-y-2">
          {session.participants.map((p) => (
            <ParticipantRow key={p.id} sessionId={id} participant={p} readOnly={session.status === "COMPLETED"} />
          ))}
        </div>
      )}
    </div>
  );
}

function ParticipantRow({
  sessionId,
  participant,
  readOnly,
}: {
  sessionId: string;
  participant: CalibrationParticipant;
  readOnly: boolean;
}) {
  const [score, setScore] = useState(participant.calibratedScore?.toString() ?? "");
  const [potential, setPotential] = useState<PotentialLevel | "">(participant.potential ?? "");
  const updateMut = useUpdateParticipantCalibration();

  async function save() {
    try {
      await updateMut.mutateAsync({
        sessionId,
        participantId: participant.id,
        input: {
          ...(score.trim() ? { calibratedScore: Number(score) } : {}),
          ...(potential ? { potential } : {}),
        },
      });
      toast.success("บันทึกแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <Card className="flex flex-row flex-wrap items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{fullName(participant.employee.firstName, participant.employee.lastName)}</p>
        <p className="text-xs text-muted-foreground">
          {participant.employee.employeeCode} · คะแนนเดิม {participant.overallScore ?? "-"}{" "}
          {participant.band && (
            <span className={cn("ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium", toneClass(bandTone(participant.band)))}>
              {participant.band}
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Input
          type="number"
          step="0.5"
          min={1}
          max={5}
          className="h-8 w-20"
          placeholder="คะแนน"
          value={score}
          disabled={readOnly}
          onChange={(e) => setScore(e.target.value)}
        />
        <Select value={potential} onValueChange={(v) => setPotential((v as PotentialLevel) ?? "")} disabled={readOnly}>
          <SelectTrigger className="h-8 w-28">
            <SelectValue placeholder="ศักยภาพ" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(POTENTIAL_LABEL) as PotentialLevel[]).map((k) => (
              <SelectItem key={k} value={k}>
                {POTENTIAL_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!readOnly && (
          <Button variant="outline" size="icon-sm" aria-label="บันทึก" onClick={save} disabled={updateMut.isPending}>
            <Save className="size-3.5" />
          </Button>
        )}
      </div>
    </Card>
  );
}
