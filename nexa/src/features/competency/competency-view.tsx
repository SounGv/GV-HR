"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Copy, Sparkles, FolderKanban, Grid3x3, Search } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { groupByCategory } from "@/lib/competency-grouping";
import { useCompetencyCategories, useDeleteCompetencyCategory } from "@/features/competency-category/hooks";
import type { CompetencyCategory } from "@/features/competency-category/types";

import { useCompetencies, useDeleteCompetency, useDuplicateCompetency } from "./hooks";
import type { Competency } from "./types";

/**
 * "คลังคำถามประเมิน" (Question Bank) — this is still the Competency model/
 * feature underneath (reused, not duplicated: see the schema doc comment)
 * so a campaign built from the legacy Competency path keeps working
 * unchanged; the rebranded name/UI here just surfaces the fields that make
 * it reusable across templates (search, usage count, duplicate).
 */
export function CompetencyView() {
  const { can } = useAuth();
  const canManage = can("campaign:create");
  const canDelete = can("campaign:delete");

  const [search, setSearch] = useState("");
  const { data, isLoading, isError, refetch } = useCompetencies({ includeInactive: true, search: search || undefined });
  const deleteMutation = useDeleteCompetency();
  const duplicateMutation = useDuplicateCompetency();
  const [deleteTarget, setDeleteTarget] = useState<Competency | null>(null);
  const competencies = data?.data ?? [];
  const groups = groupByCategory(competencies);

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("ลบหัวข้อเรียบร้อย");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  async function duplicate(c: Competency) {
    try {
      await duplicateMutation.mutateAsync(c.id);
      toast.success(`คัดลอก "${c.name}" เรียบร้อย`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "คัดลอกไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          คลังคำถามกลาง — ใช้สร้างแบบประเมิน/แคมเปญได้ซ้ำ ไม่ต้องสร้างหัวข้อใหม่ทุกครั้ง
        </p>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/performance/competencies/matrix" />}>
              <Grid3x3 className="size-4" /> Competency Matrix
            </Button>
            <Button render={<Link href="/performance/competencies/new" />}>
              <Plus className="size-4" /> เพิ่มหัวข้อ
            </Button>
          </div>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="ค้นหาหัวข้อ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {canManage && <CategoryManagementPanel />}

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={5} />
      ) : competencies.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="ยังไม่มีหัวข้อในคลังคำถาม"
          description={canManage ? "เพิ่มหัวข้อแรก หรือให้ AI ออกแบบให้ตอนสร้างแคมเปญ" : "ยังไม่มีข้อมูล"}
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
                        {c.usageCount > 0 && (
                          <span className="shrink-0 rounded-full bg-icon-chip-bg px-2 py-0.5 text-xs text-icon-chip-fg">
                            ใช้อยู่ {c.usageCount} จุด
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
                            aria-label="คัดลอก"
                            onClick={() => duplicate(c)}
                            disabled={duplicateMutation.isPending}
                          >
                            <Copy className="size-4" />
                          </Button>
                        )}
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
