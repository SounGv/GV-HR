"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { useDeleteEvaluationTemplate, useEvaluationTemplates, useUpdateEvaluationTemplate } from "./hooks";
import type { TemplateListItem, TemplateStatus } from "./types";

const STATUS_LABEL: Record<TemplateStatus, string> = { DRAFT: "ฉบับร่าง", ACTIVE: "พร้อมใช้งาน", ARCHIVED: "จัดเก็บ" };
const STATUS_STYLE: Record<TemplateStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-success/15 text-success",
  ARCHIVED: "bg-warning/15 text-warning",
};

export function TemplateListView() {
  const { can } = useAuth();
  const canManage = can("campaign:create");
  const canDelete = can("campaign:delete");

  const { data, isLoading, isError, refetch } = useEvaluationTemplates();
  const deleteMutation = useDeleteEvaluationTemplate();
  const [deleteTarget, setDeleteTarget] = useState<TemplateListItem | null>(null);
  const templates = data?.data ?? [];

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("ลบแบบประเมินเรียบร้อย");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">แบบประเมินที่ HR สร้างเอง — ใช้เลือกตอนสร้างรอบประเมิน</p>
        {canManage && (
          <Button render={<Link href="/performance/templates/new" />}>
            <Plus className="size-4" /> สร้างแบบประเมิน
          </Button>
        )}
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={4} />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="ยังไม่มีแบบประเมิน"
          description={canManage ? "สร้างแบบประเมินแรก หรือให้ AI ออกแบบให้" : "ยังไม่มีข้อมูล"}
        />
      ) : (
        <Card className="divide-y divide-border p-0">
          {templates.map((t) => (
            <TemplateRow key={t.id} template={t} canManage={canManage} canDelete={canDelete} onDelete={() => setDeleteTarget(t)} />
          ))}
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="ยืนยันการลบแบบประเมิน"
        description={deleteTarget ? `ต้องการลบ "${deleteTarget.name}" ใช่หรือไม่?` : undefined}
        destructive
        confirmLabel="ลบ"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function TemplateRow({
  template,
  canManage,
  canDelete,
  onDelete,
}: {
  template: TemplateListItem;
  canManage: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const updateMutation = useUpdateEvaluationTemplate(template.id);

  async function setStatus(status: TemplateStatus) {
    try {
      await updateMutation.mutateAsync({ status });
      toast.success(`เปลี่ยนสถานะเป็น "${STATUS_LABEL[status]}" แล้ว`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เปลี่ยนสถานะไม่สำเร็จ");
    }
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">{template.name}</span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[template.status]}`}>
            {STATUS_LABEL[template.status]}
          </span>
        </div>
        {template.description && <p className="mt-0.5 truncate text-sm text-muted-foreground">{template.description}</p>}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {template.sectionCount} หมวด · {template.questionCount} ข้อย่อย
        </p>
      </div>
      {canManage && (
        <div className="flex shrink-0 items-center gap-1.5">
          {template.status === "DRAFT" && (
            <Button size="sm" variant="outline" disabled={updateMutation.isPending} onClick={() => setStatus("ACTIVE")}>
              เปิดใช้งาน
            </Button>
          )}
          {template.status === "ACTIVE" && (
            <Button size="sm" variant="outline" disabled={updateMutation.isPending} onClick={() => setStatus("ARCHIVED")}>
              จัดเก็บ
            </Button>
          )}
          {template.status === "ARCHIVED" && (
            <Button size="sm" variant="outline" disabled={updateMutation.isPending} onClick={() => setStatus("ACTIVE")}>
              เปิดใช้งานอีกครั้ง
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" aria-label="แก้ไข" render={<Link href={`/performance/templates/${template.id}/edit`} />}>
            <Pencil className="size-4" />
          </Button>
          {canDelete && template.status === "DRAFT" && (
            <Button variant="ghost" size="icon-sm" aria-label="ลบ" onClick={onDelete}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
