"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Target, BookOpen, CalendarClock, ClipboardList, MoreHorizontal, Gauge, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { useCampaigns, useDeleteCampaign } from "./hooks";
import { CloneCampaignDialog } from "./clone-campaign-dialog";

const STATUS_LABEL: Record<string, string> = { DRAFT: "ฉบับร่าง", ACTIVE: "กำลังดำเนินการ", CLOSED: "ปิดแล้ว" };
const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-success/10 text-success",
  CLOSED: "bg-info/10 text-info",
};

export function CampaignView() {
  const router = useRouter();
  const { can } = useAuth();
  const canManage = can("campaign:create");
  const canDelete = can("campaign:delete");

  const { data, isLoading, isError, refetch } = useCampaigns();
  const campaigns = data?.data ?? [];
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const deleteMutation = useDeleteCampaign();

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("ลบรอบประเมินฉบับร่างแล้ว");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">รอบประเมินผลงาน — ตนเอง / หัวหน้างาน / เพื่อนร่วมงาน / ลูกทีม / HR</p>
        <div className="flex items-center gap-2">
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="จัดการเพิ่มเติม" />}>
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem render={<Link href="/performance/templates" />}>
                  <ClipboardList className="size-4" /> แบบประเมิน
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/performance/competencies" />}>
                  <BookOpen className="size-4" /> เกณฑ์การประเมิน (แบบเดิม)
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/performance/campaigns/schedules" />}>
                  <CalendarClock className="size-4" /> รอบอัตโนมัติ
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/performance/settings/thresholds" />}>
                  <Gauge className="size-4" /> เกณฑ์คะแนนประเมินผล
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canManage && (
            <Button render={<Link href="/performance/campaigns/new" />}>
              <Plus className="size-4" /> สร้างรอบประเมิน
            </Button>
          )}
        </div>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={3} />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Target}
          title="ยังไม่มีแคมเปญประเมินผล"
          description={canManage ? "สร้างแคมเปญแรก หรือให้ AI ออกแบบให้" : "ยังไม่มีข้อมูล"}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {campaigns.map((c) => (
            <Card
              key={c.id}
              className="gap-2 p-4 transition hover:border-primary/40 hover:shadow-sm cursor-pointer"
              onClick={() => router.push(`/performance/campaigns/${c.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-foreground">{c.name}</span>
                    {c.aiGenerated && (
                      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <Sparkles className="size-2.5" /> AI
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.cycle} · {formatDate(c.startDate)} - {formatDate(c.endDate)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                  {canManage && <CloneCampaignDialog campaignId={c.id} sourceName={c.name} sourceCycle={c.cycle} />}
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="แก้ไข"
                      render={<Link href={`/performance/campaigns/${c.id}/edit`} />}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  {canDelete && c.status === "DRAFT" && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="ลบ"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteTarget({ id: c.id, name: c.name });
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">ผู้เข้าร่วม {c.participantCount} คน</p>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="ยืนยันการลบรอบประเมิน"
        description={deleteTarget ? `ต้องการลบรอบประเมินฉบับร่าง "${deleteTarget.name}" ใช่หรือไม่? ลบได้เฉพาะฉบับร่างที่ยังไม่เผยแพร่เท่านั้น` : undefined}
        destructive
        confirmLabel="ลบ"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
