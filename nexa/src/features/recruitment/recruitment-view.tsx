"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Briefcase, Users, RefreshCcw, ArrowRightLeft, Search } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusChip } from "@/components/shared/status-chip";
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
import { ApiError } from "@/lib/api/client";
import { EMPLOYMENT_LABEL } from "@/features/employee/labels";

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
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
  const [search, setSearch] = useState("");
  const jobs = data?.data ?? [];
  const visibleJobs = search.trim()
    ? jobs.filter((j) =>
        [j.title, j.departmentName, j.location].some((v) => (v ?? "").toLowerCase().includes(search.trim().toLowerCase())),
      )
    : jobs;
  const openJobs = jobs.filter((j) => j.status === "OPEN").length;
  const totalCandidates = jobs.reduce((sum, j) => sum + j.candidateCount, 0);

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาตำแหน่งงาน ฝ่าย หรือสถานที่" aria-label="ค้นหาตำแหน่งงาน" className="pl-8" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCcw className="size-4" /> รีเฟรช
          </Button>
          {canManage && (
            <Button size="sm" render={<Link href="/recruitment/jobs/new" />}>
              <Plus className="size-4" /> ประกาศตำแหน่ง
            </Button>
          )}
        </div>
      </div>
      <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <div className="flex items-baseline gap-1">
          <dt>ตำแหน่งเปิด</dt>
          <dd className="font-semibold text-foreground tabular-nums">{openJobs}</dd>
        </div>
        <div className="flex items-baseline gap-1">
          <dt>ผู้สมัครรวม</dt>
          <dd className="font-semibold text-foreground tabular-nums">{totalCandidates}</dd>
        </div>
      </dl>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={4} />
      ) : jobs.length === 0 ? (
        <EmptyState icon={Briefcase} title="ยังไม่มีตำแหน่งงาน" description={canManage ? "เริ่มต้นด้วยการประกาศรับสมัคร" : "ยังไม่มีข้อมูล"} />
      ) : (
        visibleJobs.length === 0 ? (
          <EmptyState icon={Briefcase} title="ไม่พบตำแหน่งงาน" description="ลองเปลี่ยนคำค้นหา" />
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-center">ลำดับ</TableHead>
              <TableHead className="w-full">ตำแหน่งงาน</TableHead>
              <TableHead>ฝ่าย / แผนก</TableHead>
              <TableHead>ประเภทการจ้าง</TableHead>
              <TableHead>สถานที่</TableHead>
              <TableHead className="text-center">อัตรา</TableHead>
              <TableHead className="text-center">ผู้สมัคร</TableHead>
              <TableHead className="text-center">สถานะ</TableHead>
              {canManage && <TableHead className="text-center">จัดการ</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleJobs.map((j, i) => (
              <TableRow key={j.id}>
                <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                <TableCell className="whitespace-normal">
                  <Link href={`/recruitment/jobs/${j.id}`} className="font-medium break-words text-foreground hover:text-primary hover:underline">
                    {j.title}
                  </Link>
                </TableCell>
                <TableCell>{j.departmentName ?? "-"}</TableCell>
                <TableCell>{EMPLOYMENT_LABEL[j.employmentType as keyof typeof EMPLOYMENT_LABEL] ?? "-"}</TableCell>
                <TableCell>{j.location ?? "-"}</TableCell>
                <TableCell className="text-center tabular-nums">{j.openings}</TableCell>
                <TableCell className="text-center tabular-nums">{j.candidateCount}</TableCell>
                <TableCell className="text-center">
                  <StatusChip tone={j.status === "OPEN" ? "success" : "neutral"} label={JOB_STATUS_LABEL[j.status]} />
                </TableCell>
                {canManage && (
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="size-9" aria-label={`แก้ไข ${j.title}`} render={<Link href={`/recruitment/jobs/${j.id}/edit`} />}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-9 text-destructive" aria-label={`ลบ ${j.title}`} onClick={() => setDeleteTarget(j)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )
      )}

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
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);
  const [stageTarget, setStageTarget] = useState<Candidate | null>(null);
  const [pendingStage, setPendingStage] = useState<CandidateStage | null>(null);
  const [search, setSearch] = useState("");
  const candidates = data?.data ?? [];
  const visibleCandidates = search.trim()
    ? candidates.filter((c) =>
        [c.name, c.email, c.phone, c.jobPosting.title].some((v) => (v ?? "").toLowerCase().includes(search.trim().toLowerCase())),
      )
    : candidates;
  const stageStats = candidates.reduce(
    (acc, c) => {
      acc[c.stage] = (acc[c.stage] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const addCandidateHref =
    jobFilter === ALL ? "/recruitment/candidates/new" : `/recruitment/candidates/new?job=${jobFilter}`;

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

  async function confirmStageChange() {
    if (!stageTarget || !pendingStage) return;
    try {
      await updateMut.mutateAsync({ id: stageTarget.id, input: { stage: pendingStage } });
      toast.success(`เลื่อนสถานะเป็น ${CANDIDATE_STAGE_LABEL[pendingStage]} แล้ว`);
      setStageTarget(null);
      setPendingStage(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "อัปเดตไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อ อีเมล หรือเบอร์โทร" aria-label="ค้นหาผู้สมัคร" className="pl-8" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={jobFilter} onValueChange={(v) => setJobFilter(v ?? ALL)}>
            <SelectTrigger className="min-w-[160px] w-auto max-w-[320px]">
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
            <SelectTrigger className="min-w-[160px] w-auto max-w-[320px]">
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCcw className="size-4" /> รีเฟรช
          </Button>
          {canManage && (
            <Button size="sm" render={<Link href={addCandidateHref} />}>
              <Plus className="size-4" /> เพิ่มผู้สมัคร
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Card className="min-w-[140px] gap-1 border-0 bg-muted/60 p-3">
          <div className="text-xs text-muted-foreground">ผู้สมัครทั้งหมด</div>
          <div className="text-lg font-semibold">{candidates.length}</div>
        </Card>
        <Card className="min-w-[140px] gap-1 border-0 bg-muted/60 p-3">
          <div className="text-xs text-muted-foreground">รอสัมภาษณ์</div>
          <div className="text-lg font-semibold">{stageStats.INTERVIEW ?? 0}</div>
        </Card>
        <Card className="min-w-[140px] gap-1 border-0 bg-muted/60 p-3">
          <div className="text-xs text-muted-foreground">ผ่านแล้ว</div>
          <div className="text-lg font-semibold text-success">{stageStats.OFFER ?? 0}</div>
        </Card>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={5} />
      ) : candidates.length === 0 ? (
        <EmptyState icon={Users} title="ยังไม่มีผู้สมัคร" description="ผู้สมัครในตำแหน่งที่เลือกจะแสดงที่นี่" />
      ) : (
        visibleCandidates.length === 0 ? (
          <EmptyState icon={Users} title="ไม่พบผู้สมัคร" description="ลองเปลี่ยนคำค้นหา" />
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-center">ลำดับ</TableHead>
              <TableHead className="w-full">ชื่อผู้สมัคร</TableHead>
              <TableHead>ตำแหน่งที่สมัคร</TableHead>
              <TableHead>อีเมล</TableHead>
              <TableHead>เบอร์โทร</TableHead>
              <TableHead className="text-center">สถานะ</TableHead>
              {canManage && <TableHead className="text-center">จัดการ</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleCandidates.map((c, i) => (
              <TableRow key={c.id}>
                <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                <TableCell className="whitespace-normal">
                  <Link href={`/recruitment/candidates/${c.id}`} className="font-medium break-words text-foreground hover:text-primary hover:underline">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell>{c.jobPosting.title}</TableCell>
                <TableCell>{c.email ?? "-"}</TableCell>
                <TableCell className="tabular-nums">{c.phone ?? "-"}</TableCell>
                <TableCell className="text-center">
                  <CandidateStageBadge stage={c.stage} />
                </TableCell>
                {canManage && (
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setStageTarget(c);
                          setPendingStage(c.stage);
                        }}
                      >
                        <ArrowRightLeft className="size-4" /> เลื่อนสถานะ
                      </Button>
                      <Button variant="ghost" size="icon" className="size-9" aria-label={`แก้ไข ${c.name}`} render={<Link href={`/recruitment/candidates/${c.id}/edit`} />}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-9 text-destructive" aria-label={`ลบ ${c.name}`} onClick={() => setDeleteTarget(c)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )
      )}

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

      <ConfirmDialog
        open={!!stageTarget}
        onOpenChange={(o) => {
          if (!o) {
            setStageTarget(null);
            setPendingStage(null);
          }
        }}
        title="เลื่อนสถานะผู้สมัคร"
        description={stageTarget ? `ย้าย "${stageTarget.name}" เป็น ${pendingStage ? CANDIDATE_STAGE_LABEL[pendingStage] : "สถานะใหม่"} หรือไม่?` : undefined}
        confirmLabel="ยืนยัน"
        loading={updateMut.isPending}
        onConfirm={confirmStageChange}
      />
    </div>
  );
}
