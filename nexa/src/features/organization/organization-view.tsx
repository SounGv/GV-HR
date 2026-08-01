"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Building2, Briefcase, CornerDownRight, Users } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";

import { DepartmentDialog } from "./department-dialog";
import { PositionDialog } from "./position-dialog";
import { OrgChart } from "./org-chart";
import { JOB_LEVELS } from "./schema";
import {
  useDepartments,
  usePositions,
  useDeleteDepartment,
  useDeletePosition,
} from "./hooks";
import type { DepartmentRow, DepartmentNode, PositionRow } from "./types";

function buildTree(rows: DepartmentRow[]): DepartmentNode[] {
  const nodes = new Map<string, DepartmentNode>();
  rows.forEach((r) => nodes.set(r.id, { ...r, children: [] }));
  const roots: DepartmentNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function levelLabel(level: number): string {
  return JOB_LEVELS.find((l) => l.value === level)?.label ?? `ระดับ ${level}`;
}

export function OrganizationView() {
  const { can, user } = useAuth();
  const canCreate = can("employee:create");
  const canUpdate = can("employee:update");
  const canDelete = can("employee:delete");

  const deptQuery = useDepartments();
  const posQuery = usePositions();
  const departments = useMemo(() => deptQuery.data?.data ?? [], [deptQuery.data]);
  const positions = posQuery.data?.data ?? [];
  const tree = useMemo(() => buildTree(departments), [departments]);

  const deleteDeptMut = useDeleteDepartment();
  const deletePosMut = useDeletePosition();

  const [deptDialog, setDeptDialog] = useState(false);
  const [editDept, setEditDept] = useState<DepartmentRow | null>(null);
  const [delDept, setDelDept] = useState<DepartmentRow | null>(null);

  const [posDialog, setPosDialog] = useState(false);
  const [editPos, setEditPos] = useState<PositionRow | null>(null);
  const [delPos, setDelPos] = useState<PositionRow | null>(null);

  async function confirmDelDept() {
    if (!delDept) return;
    try {
      await deleteDeptMut.mutateAsync(delDept.id);
      toast.success("ลบฝ่ายแล้ว");
      setDelDept(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }
  async function confirmDelPos() {
    if (!delPos) return;
    try {
      await deletePosMut.mutateAsync(delPos.id);
      toast.success("ลบตำแหน่งแล้ว");
      setDelPos(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  function DeptRow({ node, depth }: { node: DepartmentNode; depth: number }) {
    return (
      <>
        <div
          className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-muted/50"
          style={{ paddingLeft: depth * 20 + 8 }}
        >
          <div className="flex min-w-0 items-center gap-2">
            {depth > 0 ? (
              <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <Building2 className="size-4 shrink-0 text-primary" />
            )}
            <span className={depth === 0 ? "font-medium" : ""}>{node.name}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {node.code}
            </span>
            {node.employeeCount > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Users className="size-3" />
                {node.employeeCount}
              </span>
            )}
          </div>
          {(canUpdate || canDelete) && (
            <div className="flex shrink-0 items-center gap-0.5">
              {canUpdate && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => {
                    setEditDept(node);
                    setDeptDialog(true);
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
                  className="size-7 text-destructive"
                  onClick={() => setDelDept(node)}
                  aria-label="ลบ"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
        {node.children.map((c) => (
          <DeptRow key={c.id} node={c} depth={depth + 1} />
        ))}
      </>
    );
  }

  return (
    <Tabs defaultValue="departments" className="space-y-4">
      <TabsList>
        <TabsTrigger value="departments">ฝ่าย / แผนก</TabsTrigger>
        <TabsTrigger value="positions">ตำแหน่ง / ระดับ</TabsTrigger>
        <TabsTrigger value="chart">ผังองค์กร</TabsTrigger>
      </TabsList>

      <TabsContent value="chart">
        {deptQuery.isLoading ? (
          <TableLoadingState rows={4} />
        ) : deptQuery.isError ? (
          <ErrorState onRetry={() => deptQuery.refetch()} />
        ) : (
          <OrgChart tree={tree} companyName={user.company?.name} />
        )}
      </TabsContent>

      {/* Departments */}
      <TabsContent value="departments" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">โครงสร้างฝ่าย/แผนก</h2>
          {canCreate && (
            <Button
              onClick={() => {
                setEditDept(null);
                setDeptDialog(true);
              }}
            >
              <Plus className="size-4" /> เพิ่มฝ่าย
            </Button>
          )}
        </div>
        {deptQuery.isError ? (
          <ErrorState onRetry={() => deptQuery.refetch()} />
        ) : deptQuery.isLoading ? (
          <TableLoadingState rows={6} />
        ) : tree.length === 0 ? (
          <EmptyState icon={Building2} title="ยังไม่มีฝ่าย" description="เริ่มต้นด้วยการเพิ่มฝ่ายหลัก" />
        ) : (
          <Card className="p-2">
            {tree.map((n) => (
              <DeptRow key={n.id} node={n} depth={0} />
            ))}
          </Card>
        )}
      </TabsContent>

      {/* Positions */}
      <TabsContent value="positions" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">ตำแหน่งและระดับ</h2>
          {canCreate && (
            <Button
              onClick={() => {
                setEditPos(null);
                setPosDialog(true);
              }}
            >
              <Plus className="size-4" /> เพิ่มตำแหน่ง
            </Button>
          )}
        </div>
        {posQuery.isError ? (
          <ErrorState onRetry={() => posQuery.refetch()} />
        ) : posQuery.isLoading ? (
          <TableLoadingState rows={6} />
        ) : positions.length === 0 ? (
          <EmptyState icon={Briefcase} title="ยังไม่มีตำแหน่ง" description="เพิ่มตำแหน่งพร้อมระดับ" />
        ) : (
          <Card className="divide-y divide-border p-0">
            {positions.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.title}</span>
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {levelLabel(p.level)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.code}
                    {p.department ? ` · ${p.department.name}` : ""}
                    {p.employeeCount > 0 ? ` · ${p.employeeCount} คน` : ""}
                  </p>
                </div>
                {(canUpdate || canDelete) && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    {canUpdate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => {
                          setEditPos(p);
                          setPosDialog(true);
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
                        className="size-7 text-destructive"
                        onClick={() => setDelPos(p)}
                        aria-label="ลบ"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </Card>
        )}
      </TabsContent>

      <DepartmentDialog
        open={deptDialog}
        onOpenChange={setDeptDialog}
        department={editDept}
        departments={departments}
      />
      <PositionDialog
        open={posDialog}
        onOpenChange={setPosDialog}
        position={editPos}
        departments={departments}
      />
      <ConfirmDialog
        open={!!delDept}
        onOpenChange={(o) => !o && setDelDept(null)}
        title="ลบฝ่าย/แผนก?"
        description={delDept?.name}
        confirmLabel="ลบ"
        destructive
        loading={deleteDeptMut.isPending}
        onConfirm={confirmDelDept}
      />
      <ConfirmDialog
        open={!!delPos}
        onOpenChange={(o) => !o && setDelPos(null)}
        title="ลบตำแหน่ง?"
        description={delPos?.title}
        confirmLabel="ลบ"
        destructive
        loading={deletePosMut.isPending}
        onConfirm={confirmDelPos}
      />
    </Tabs>
  );
}
