"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { useAppraisalForms, useCreateAppraisalForm, useDeleteAppraisalForm } from "./hooks";
import { STATUS_LABEL, type FormListItem, type FormStatus } from "./types";

const TONE: Record<FormStatus, StatusTone> = { DRAFT: "warning", PUBLISHED: "success", ARCHIVED: "neutral" };

/** All appraisal forms, latest version of each. A new form opens straight in the editor. */
export function FormListView() {
  const router = useRouter();
  const { can } = useAuth();
  const canCreate = can("campaign:create");
  const canDelete = can("campaign:delete");
  const { data, isLoading, isError, refetch } = useAppraisalForms();
  const create = useCreateAppraisalForm();
  const remove = useDeleteAppraisalForm();
  const [target, setTarget] = useState<FormListItem | null>(null);
  const forms = data?.data ?? [];

  async function startNew() {
    try {
      const res = await create.mutateAsync("แบบประเมินใหม่");
      router.push(`/appraisal/forms/${res.data.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "สร้างแบบประเมินไม่สำเร็จ");
    }
  }

  async function confirmDelete() {
    if (!target) return;
    try {
      await remove.mutateAsync(target.id);
      toast.success("ลบฉบับร่างแล้ว");
      setTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">แบบประเมินมีเวอร์ชัน แบบที่ใช้งานแล้วแก้ไม่ได้ ต้องสร้างเวอร์ชันใหม่</p>
        {canCreate && (
          <Button className="h-11 md:h-9" onClick={startNew} disabled={create.isPending}>
            <Plus className="size-4" /> สร้างแบบประเมิน
          </Button>
        )}
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={4} />
      ) : forms.length === 0 ? (
        <EmptyState icon={ClipboardList} title="ยังไม่มีแบบประเมิน" description="กด “สร้างแบบประเมิน” เพื่อเริ่ม" />
      ) : (
        <Card className="gap-0 divide-y divide-border p-0">
          {forms.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <Link href={`/appraisal/forms/${f.id}`} className="min-w-0 flex-1 hover:underline">
                <span className="block text-sm font-semibold break-words text-foreground">{f.name}</span>
                <span className="block text-sm text-muted-foreground">
                  เวอร์ชัน {f.version} · {f.questionCount} คำถาม
                </span>
              </Link>
              <div className="flex items-center gap-2">
                <StatusChip tone={TONE[f.status]} label={STATUS_LABEL[f.status]} />
                {canDelete && f.status === "DRAFT" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 md:size-9"
                    aria-label={`ลบฉบับร่าง ${f.name}`}
                    onClick={() => setTarget(f)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}

      <ConfirmDialog
        open={!!target}
        onOpenChange={(open) => !open && setTarget(null)}
        title="ลบฉบับร่างนี้?"
        description={target ? `“${target.name}” จะถูกลบ` : undefined}
        confirmLabel="ลบ"
        destructive
        onConfirm={confirmDelete}
        loading={remove.isPending}
      />
    </div>
  );
}
