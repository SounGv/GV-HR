"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, GraduationCap, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger, stickyTabsRow } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusChip } from "@/components/shared/status-chip";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api/client";

import { EnrollmentStatusBadge } from "./labels";
import {
  useCourses,
  useMyEnrollments,
  useEnroll,
  useCancelEnrollment,
  useDeleteCourse,
} from "./hooks";
import type { TrainingCourse } from "./types";

export function TrainingView() {
  const { can } = useAuth();
  const canCreate = can("training:create");
  const canUpdate = can("training:update");
  const canDelete = can("training:delete");

  const coursesQuery = useCourses();
  const enrollmentsQuery = useMyEnrollments();
  const courses = coursesQuery.data?.data ?? [];
  const enrollments = enrollmentsQuery.data?.data ?? [];

  const enrollMut = useEnroll();
  const cancelMut = useCancelEnrollment();
  const deleteMut = useDeleteCourse();

  const [deleteTarget, setDeleteTarget] = useState<TrainingCourse | null>(null);
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const visibleCourses = q
    ? courses.filter((c) => [c.title, c.category, c.provider, c.location].some((v) => (v ?? "").toLowerCase().includes(q)))
    : courses;

  async function enroll(id: string) {
    try {
      await enrollMut.mutateAsync(id);
      toast.success("ลงทะเบียนเรียบร้อย");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลงทะเบียนไม่สำเร็จ");
    }
  }

  async function cancel(id: string) {
    try {
      await cancelMut.mutateAsync(id);
      toast.success("ยกเลิกการลงทะเบียนแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ยกเลิกไม่สำเร็จ");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast.success("ลบหลักสูตรแล้ว");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="courses">
        <div className={cn("flex items-center justify-between gap-2", stickyTabsRow)}>
          <TabsList>
            <TabsTrigger value="courses">หลักสูตร</TabsTrigger>
            <TabsTrigger value="mine">การอบรมของฉัน</TabsTrigger>
          </TabsList>
          {canCreate && (
            <Button size="sm" render={<Link href="/training/new" />}>
              <Plus className="size-4" />
              สร้างหลักสูตร
            </Button>
          )}
        </div>

        <TabsContent value="courses" className="mt-4">
          {coursesQuery.isLoading ? (
            <TableLoadingState />
          ) : coursesQuery.isError ? (
            <ErrorState onRetry={() => coursesQuery.refetch()} />
          ) : courses.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="ยังไม่มีหลักสูตร"
              description={canCreate ? "เริ่มต้นด้วยการสร้างหลักสูตรอบรม" : "ยังไม่มีหลักสูตรเปิดอบรม"}
            />
          ) : (
            <div className="space-y-3">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาหลักสูตร หมวด หรือสถานที่" aria-label="ค้นหาหลักสูตร" className="pl-8" />
              </div>
              {visibleCourses.length === 0 ? (
                <EmptyState icon={GraduationCap} title="ไม่พบหลักสูตร" description="ลองเปลี่ยนคำค้นหา" />
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14 text-center">No.</TableHead>
                    <TableHead className="w-full">หลักสูตร</TableHead>
                    <TableHead>หมวด</TableHead>
                    <TableHead className="text-center">ชั่วโมง</TableHead>
                    <TableHead>ผู้จัด</TableHead>
                    <TableHead>วันที่อบรม</TableHead>
                    <TableHead>สถานที่</TableHead>
                    <TableHead className="text-center">ผู้ลงทะเบียน</TableHead>
                    <TableHead className="text-center">สถานะ</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleCourses.map((c, i) => {
                    const active = c.myEnrollment && c.myEnrollment.status !== "CANCELLED";
                    const full = c.capacity != null && c.enrolledCount >= c.capacity;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                        <TableCell className="min-w-[220px] whitespace-normal">
                          <Link href={`/training/${c.id}`} className="font-medium break-words text-foreground hover:text-primary hover:underline">
                            {c.title}
                          </Link>
                          {c.description && <p className="line-clamp-2 text-xs text-muted-foreground">{c.description}</p>}
                        </TableCell>
                        <TableCell>{c.category}</TableCell>
                        <TableCell className="text-center tabular-nums">{c.hours}</TableCell>
                        <TableCell>{c.provider ?? "-"}</TableCell>
                        <TableCell className="tabular-nums">{c.scheduledDate ? formatDate(c.scheduledDate) : "-"}</TableCell>
                        <TableCell>{c.location ?? "-"}</TableCell>
                        <TableCell className="text-center tabular-nums">
                          {c.enrolledCount}
                          {c.capacity != null ? ` / ${c.capacity}` : ""}
                        </TableCell>
                        <TableCell className="text-center">
                          <StatusChip tone={c.status === "OPEN" ? "success" : "neutral"} label={c.status === "OPEN" ? "เปิดรับสมัคร" : "ปิดรับสมัคร"} />
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {active ? (
                              <span className="px-2 text-xs font-medium text-primary">ลงทะเบียนแล้ว</span>
                            ) : (
                              <Button size="sm" disabled={c.status !== "OPEN" || full || enrollMut.isPending} onClick={() => enroll(c.id)}>
                                {full ? "เต็มแล้ว" : "ลงทะเบียน"}
                              </Button>
                            )}
                            {canUpdate && (
                              <Button variant="ghost" size="icon" className="size-9" render={<Link href={`/training/${c.id}/edit`} />} aria-label={`แก้ไข ${c.title}`}>
                                <Pencil className="size-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button variant="ghost" size="icon" className="size-9 text-destructive" onClick={() => setDeleteTarget(c)} aria-label={`ลบ ${c.title}`}>
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mine" className="mt-4">
          {enrollmentsQuery.isLoading ? (
            <TableLoadingState />
          ) : enrollmentsQuery.isError ? (
            <ErrorState onRetry={() => enrollmentsQuery.refetch()} />
          ) : enrollments.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="ยังไม่มีการอบรม"
              description="ลงทะเบียนหลักสูตรจากแท็บ “หลักสูตร”"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 text-center">No.</TableHead>
                  <TableHead className="w-full">หลักสูตร</TableHead>
                  <TableHead>หมวด</TableHead>
                  <TableHead className="text-center">ชั่วโมง</TableHead>
                  <TableHead>วันที่อบรม</TableHead>
                  <TableHead className="text-center">คะแนน</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((e, i) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                    <TableCell className="whitespace-normal">
                      <Link href={`/training/${e.course.id}`} className="font-medium break-words text-foreground hover:text-primary hover:underline">
                        {e.course.title}
                      </Link>
                    </TableCell>
                    <TableCell>{e.course.category}</TableCell>
                    <TableCell className="text-center tabular-nums">{e.course.hours}</TableCell>
                    <TableCell className="tabular-nums">{e.course.scheduledDate ? formatDate(e.course.scheduledDate) : "-"}</TableCell>
                    <TableCell className="text-center tabular-nums">{e.status === "COMPLETED" && e.score != null ? e.score : "-"}</TableCell>
                    <TableCell className="text-center">
                      <EnrollmentStatusBadge status={e.status} />
                    </TableCell>
                    <TableCell className="text-center">
                      {e.status === "ENROLLED" && (
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => cancel(e.id)} disabled={cancelMut.isPending}>
                          ยกเลิก
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="ลบหลักสูตร?"
        description={deleteTarget?.title}
        confirmLabel="ลบ"
        destructive
        loading={deleteMut.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
