"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Briefcase, Users } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { EMPLOYMENT_LABEL } from "@/features/employee/labels";

import { JobDialog } from "./job-dialog";
import { CandidateDialog } from "./candidate-dialog";
import { CANDIDATE_STAGE_LABEL, CandidateStageBadge, JOB_STATUS_LABEL } from "./labels";
import { CANDIDATE_STAGES } from "./schema";
import {
  useJobs,
  useCandidates,
  useDeleteJob,
  useDeleteCandidate,
  useUpdateCandidate,
} from "./hooks";
import type { Candidate, CandidateStage, Job } from "./types";

const ALL = "ALL";

export function RecruitmentView() {
  const { can } = useAuth();
  const canManage = can("recruitment:create");

  return (
    <Tabs defaultValue="jobs" className="space-y-4">
      <TabsList>
        <TabsTrigger value="jobs">ตำแหน่งงาน</TabsTrigger>
        <TabsTrigger value="candidates">ผู้สมัคร</TabsTrigger>
      </TabsList>
      <TabsContent value="jobs">
        <Jobs canManage={canManage} />
      </TabsContent>
      <TabsContent value="candidates">
        <Candidates canManage={canManage} />
      </TabsContent>
    </Tabs>
  );
}

function Jobs({ canManage }: { canManage: boolean }) {
  const { data, isLoading, isError, refetch } = useJobs();
  const deleteMut = useDeleteJob();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
  const jobs = data?.data ?? [];

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast.success("ลบตำแหน่งงานเรียบร้อย");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" /> ประกาศตำแหน่ง
          </Button>
        </div>
      )}

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={4} />
      ) : jobs.length === 0 ? (
        <EmptyState icon={Briefcase} title="ยังไม่มีตำแหน่งงาน" description={canManage ? "เริ่มต้นด้วยการประกาศรับสมัคร" : "ยังไม่มีข้อมูล"} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {jobs.map((j) => (
            <Card key={j.id} className="gap-2 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground">{j.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {[j.departmentName, EMPLOYMENT_LABEL[j.employmentType as keyof typeof EMPLOYMENT_LABEL], j.location]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    j.status === "OPEN" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
                  )}
                >
                  {JOB_STATUS_LABEL[j.status]}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  รับ {j.openings} อัตรา · ผู้สมัคร {j.candidateCount} คน
                </span>
                {canManage && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="แก้ไข"
                      onClick={() => {
                        setEditing(j);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="ลบ" onClick={() => setDeleteTarget(j)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <JobDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} job={editing} />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="ลบตำแหน่งงาน"
        description={deleteTarget ? `ต้องการลบ "${deleteTarget.title}" ใช่หรือไม่? ผู้สมัครที่เกี่ยวข้องจะถูกลบด้วย` : undefined}
        destructive
        confirmLabel="ลบ"
        loading={deleteMut.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function Candidates({ canManage }: { canManage: boolean }) {
  const { data: jobsData } = useJobs();
  const [jobFilter, setJobFilter] = useState<string>(ALL);
  const [stageFilter, setStageFilter] = useState<string>(ALL);
  const { data, isLoading, isError, refetch } = useCandidates(
    jobFilter === ALL ? undefined : jobFilter,
    stageFilter === ALL ? undefined : (stageFilter as CandidateStage),
  );
  const updateMut = useUpdateCandidate();
  const deleteMut = useDeleteCandidate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);
  const candidates = data?.data ?? [];

  async function moveStage(id: string, stage: CandidateStage) {
    try {
      await updateMut.mutateAsync({ id, input: { stage } });
      toast.success("อัปเดตสถานะแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "อัปเดตไม่สำเร็จ");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast.success("ลบผู้สมัครเรียบร้อย");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Select value={jobFilter} onValueChange={(v) => setJobFilter(v ?? ALL)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="ทุกตำแหน่ง" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>ทุกตำแหน่ง</SelectItem>
              {(jobsData?.data ?? []).map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stageFilter} onValueChange={(v) => setStageFilter(v ?? ALL)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="ทุกสถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>ทุกสถานะ</SelectItem>
              {CANDIDATE_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {CANDIDATE_STAGE_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canManage && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" /> เพิ่มผู้สมัคร
          </Button>
        )}
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={5} />
      ) : candidates.length === 0 ? (
        <EmptyState icon={Users} title="ยังไม่มีผู้สมัคร" description="ผู้สมัครในตำแหน่งที่เลือกจะแสดงที่นี่" />
      ) : (
        <div className="space-y-2">
          {candidates.map((c) => (
            <Card key={c.id} className="flex-row items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{c.name}</span>
                  <CandidateStageBadge stage={c.stage} />
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {c.jobPosting.title}
                  {c.email ? ` · ${c.email}` : ""}
                  {c.phone ? ` · ${c.phone}` : ""}
                </p>
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  <Select value={c.stage} onValueChange={(v) => v && moveStage(c.id, v as CandidateStage)}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CANDIDATE_STAGES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {CANDIDATE_STAGE_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon-sm" aria-label="ลบ" onClick={() => setDeleteTarget(c)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <CandidateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultJobId={jobFilter === ALL ? undefined : jobFilter}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="ลบผู้สมัคร"
        description={deleteTarget ? `ต้องการลบ "${deleteTarget.name}" ใช่หรือไม่?` : undefined}
        destructive
        confirmLabel="ลบ"
        loading={deleteMut.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
