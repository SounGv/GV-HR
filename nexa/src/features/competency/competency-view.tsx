"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Sparkles, FolderKanban } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { groupByCategory } from "@/lib/competency-grouping";
import { useCompetencyCategories, useDeleteCompetencyCategory } from "@/features/competency-category/hooks";
import type { CompetencyCategory } from "@/features/competency-category/types";

import { useCompetencies, useDeleteCompetency } from "./hooks";
import type { Competency } from "./types";

export function CompetencyView() {
  const { can } = useAuth();
  const canManage = can("campaign:create");
  const canDelete = can("campaign:delete");

  const { data, isLoading, isError, refetch } = useCompetencies(true);
  const deleteMutation = useDeleteCompetency();
  const [deleteTarget, setDeleteTarget] = useState<Competency | null>(null);
  const competencies = data?.data ?? [];
  const groups = groupByCategory(competencies);

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("ลบสมรรถนะเรียบร้อย");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          สมรรถนะในคลังนี้ใช้ประกอบสร้างแคมเปญประเมินผล
        </p>
        {canManage && (
          <Button render={<Link href="/performance/competencies/new" />}>
            <Plus className="size-4" /> เพิ่มสมรรถนะ
          </Button>
        )}
      </div>

      {canManage && <CategoryManagementPanel />}

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={5} />
      ) : competencies.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="ยังไม่มีสมรรถนะในคลัง"
          description={canManage ? "เพิ่มสมรรถนะแรก หรือให้ AI ออกแบบให้ตอนสร้างแคมเปญ" : "ยังไม่มีข้อมูล"}
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.categoryId} className="space-y-2">
              <p className="px-1 text-sm font-semibold text-foreground">{group.categoryName}</p>
              <Card className="divide-y divide-border p-0">
                {group.items.map((c) => (
                  <div key={c.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-foreground">{c.name}</span>
                        {!c.active && (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            ปิดใช้งาน
                          </span>
                        )}
                      </div>
                      {c.description && (
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">{c.description}</p>
                      )}
                      {c.exampleBehavior && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          ตัวอย่างพฤติกรรม: {c.exampleBehavior}
                        </p>
                      )}
                    </div>
                    {(canManage || canDelete) && (
                      <div className="flex shrink-0 items-center gap-1">
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="แก้ไข"
                            render={<Link href={`/performance/competencies/${c.id}/edit`} />}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="ลบ"
                            onClick={() => setDeleteTarget(c)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="ยืนยันการลบสมรรถนะ"
        description={deleteTarget ? `ต้องการลบ "${deleteTarget.name}" ใช่หรือไม่?` : undefined}
        destructive
        confirmLabel="ลบ"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function CategoryManagementPanel() {
  const { data, isLoading } = useCompetencyCategories();
  const deleteMutation = useDeleteCompetencyCategory();
  const [deleteTarget, setDeleteTarget] = useState<CompetencyCategory | null>(null);
  const categories = data?.data ?? [];

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("ลบหมวดหมู่เรียบร้อย — สมรรถนะที่เคยอยู่ในหมวดนี้ย้ายไปกลุ่ม \"ไม่มีหมวดหมู่\"");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <Card className="gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <FolderKanban className="size-4" /> หมวดหมู่สมรรถนะ
        </p>
        <Button variant="outline" size="sm" render={<Link href="/performance/competencies/categories/new" />}>
          <Plus className="size-4" /> เพิ่มหมวดหมู่
        </Button>
      </div>
      {!isLoading && categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีหมวดหมู่ — สมรรถนะทั้งหมดจะแสดงในกลุ่ม &quot;ไม่มีหมวดหมู่&quot;</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span
              key={cat.id}
              className="flex items-center gap-1.5 rounded-full border border-border py-1 pr-1 pl-3 text-xs"
            >
              {cat.name}
              <Link
                href={`/performance/competencies/categories/${cat.id}/edit`}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="แก้ไขหมวดหมู่"
              >
                <Pencil className="size-3" />
              </Link>
              <button
                type="button"
                onClick={() => setDeleteTarget(cat)}
                className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="ลบหมวดหมู่"
              >
                <Trash2 className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="ยืนยันการลบหมวดหมู่"
        description={deleteTarget ? `ต้องการลบหมวดหมู่ "${deleteTarget.name}" ใช่หรือไม่?` : undefined}
        destructive
        confirmLabel="ลบ"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
