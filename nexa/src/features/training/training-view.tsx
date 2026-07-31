"use client";

import { useState } from "react";
import { Plus, GraduationCap, Pencil, Trash2, Clock, MapPin, Users, Calendar } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api/client";

import { CourseDialog } from "./course-dialog";
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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingCourse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrainingCourse | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

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
        <div className="flex items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="courses">หลักสูตร</TabsTrigger>
            <TabsTrigger value="mine">การอบรมของฉัน</TabsTrigger>
          </TabsList>
          {canCreate && (
            <Button onClick={openCreate}>
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
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => {
                const active = c.myEnrollment && c.myEnrollment.status !== "CANCELLED";
                const full = c.capacity != null && c.enrolledCount >= c.capacity;
                return (
                  <Card key={c.id} className="gap-0 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {c.category}
                      </span>
                      <span
                        className={`text-[11px] font-medium ${
                          c.status === "OPEN" ? "text-success" : "text-muted-foreground"
                        }`}
                      >
                        {c.status === "OPEN" ? "เปิดรับสมัคร" : "ปิดรับสมัคร"}
                      </span>
                    </div>
                    <p className="mt-2 font-medium leading-snug">{c.title}</p>
                    {c.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {c.description}
                      </p>
                    )}
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        {c.hours} ชม.
                        {c.provider ? ` · ${c.provider}` : ""}
                      </div>
                      {c.scheduledDate && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3.5" />
                          {formatDate(c.scheduledDate)}
                        </div>
                      )}
                      {c.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="size-3.5" />
                          {c.location}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Users className="size-3.5" />
                        {c.enrolledCount}
                        {c.capacity != null ? ` / ${c.capacity}` : ""} คน
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-1">
                      {active ? (
                        <span className="flex-1 text-center text-xs font-medium text-primary">
                          ลงทะเบียนแล้ว
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={c.status !== "OPEN" || full || enrollMut.isPending}
                          onClick={() => enroll(c.id)}
                        >
                          {full ? "เต็มแล้ว" : "ลงทะเบียน"}
                        </Button>
                      )}
                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => {
                            setEditing(c);
                            setDialogOpen(true);
                          }}
                          aria-label="แก้ไข"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive"
                          onClick={() => setDeleteTarget(c)}
                          aria-label="ลบ"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
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
            <div className="space-y-2">
              {enrollments.map((e) => (
                <Card key={e.id} className="flex-row items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="font-medium">{e.course.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.course.category} · {e.course.hours} ชม.
                      {e.course.scheduledDate ? ` · ${formatDate(e.course.scheduledDate)}` : ""}
                      {e.status === "COMPLETED" && e.score != null ? ` · คะแนน ${e.score}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <EnrollmentStatusBadge status={e.status} />
                    {e.status === "ENROLLED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => cancel(e.id)}
                        disabled={cancelMut.isPending}
                      >
                        ยกเลิก
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CourseDialog open={dialogOpen} onOpenChange={setDialogOpen} course={editing} />
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
