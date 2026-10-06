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
import { useCreateRound, useDeleteRound, useRounds } from "./hooks";
import { ROUND_STATUS_LABEL, type RoundListItem, type RoundStatus } from "./types";

const TONE: Record<RoundStatus, StatusTone> = { DRAFT: "warning", SCHEDULED: "info", OPEN: "success", CLOSED: "neutral" };

const fmt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)) : "-";

/** All appraisal rounds, newest first. A new round opens straight in the 5-step wizard. */
export function RoundListView() {
  const router = useRouter();
  const { can } = useAuth();
  const { data, isLoading, isError, refetch } = useRounds();
  const create = useCreateRound();
  const remove = useDeleteRound();
  const [target, setTarget] = useState<RoundListItem | null>(null);
  const rounds = data?.data ?? [];

  async function startNew() {
    try {
      const res = await create.mutateAsync("รอบประเมินใหม่");
      router.push(`/appraisal/rounds/${res.data.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "สร้างรอบไม่สำเร็จ");
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
        <p className="text-sm text-muted-foreground">ทำตามขั้นตอน แบบ → คน → ผู้ประเมิน → กำหนดการ → ตรวจและเปิดรอบ</p>
        {can("campaign:create") && (
          <Button className="h-11 md:h-9" onClick={startNew} disabled={create.isPending}>
            <Plus className="size-4" /> สร้างรอบประเมิน
          </Button>
        )}
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={4} />
      ) : rounds.length === 0 ? (
        <EmptyState icon={ClipboardList} title="ยังไม่มีรอบประเมิน" description="กด “สร้างรอบประเมิน” เพื่อเริ่ม (ต้องมีแบบประเมินที่ยืนยันใช้แล้วก่อน)" />
      ) : (
        <Card className="gap-0 divide-y divide-border p-0">
          {rounds.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <Link href={`/appraisal/rounds/${r.id}`} className="min-w-0 flex-1 hover:underline">
                <span className="block text-sm font-semibold break-words text-foreground">{r.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {r.formName} · {r.participantCount} คน · {fmt(r.startIso)} – {fmt(r.endIso)}
                  {r.total > 0 && ` · ส่งแล้ว ${r.submitted}/${r.total}`}
                </span>
              </Link>
              <div className="flex items-center gap-2">
                <StatusChip tone={TONE[r.status]} label={ROUND_STATUS_LABEL[r.status]} />
                {can("campaign:delete") && r.status === "DRAFT" && (
                  <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label={`ลบฉบับร่าง ${r.name}`} onClick={() => setTarget(r)}>
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
