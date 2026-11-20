"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2, Building2, Briefcase, CornerDownRight, Search } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";

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

function flattenTree(nodes: DepartmentNode[], depth = 0): { node: DepartmentNode; depth: number }[] {
  return nodes.flatMap((n) => [{ node: n, depth }, ...flattenTree(n.children, depth + 1)]);
}

function levelLabel(level: number): string {
  return JOB_LEVELS.find((l) => l.value === level)?.label ?? `ระดับ ${level}`;
}

const TABS = ["departments", "positions", "chart"] as const;

export function OrganizationView() {
  const { can, user } = useAuth();
  const canCreate = can("employee:create");
  const canUpdate = can("employee:update");
  const canDelete = can("employee:delete");

  // Nav links deep-link here via ?tab=<departments|positions|chart> (e.g.
  // "โครงสร้างองค์กร" → /organization?tab=chart) — read once so those links
  // land on the intended tab instead of always defaulting to "departments".
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = (TABS as readonly string[]).includes(tabParam ?? "") ? tabParam! : "departments";

  const deptQuery = useDepartments();
  const posQuery = usePositions();
  const departments = useMemo(() => deptQuery.data?.data ?? [], [deptQuery.data]);
  const positions = useMemo(() => posQuery.data?.data ?? [], [posQuery.data]);
  const tree = useMemo(() => buildTree(departments), [departments]);

  const deleteDeptMut = useDeleteDepartment();
  const deletePosMut = useDeletePosition();

  const [deptSearch, setDeptSearch] = useState("");
  const [posSearch, setPosSearch] = useState("");
  const deptRows = useMemo(() => {
    const q = deptSearch.trim().toLowerCase();
    const all = flattenTree(tree);
    return q ? all.filter(({ node }) => node.name.toLowerCase().includes(q) || node.code.toLowerCase().includes(q)) : all;
  }, [tree, deptSearch]);
  const posRows = useMemo(() => {
    const q = posSearch.trim().toLowerCase();
    return q
      ? positions.filter((p) => p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || (p.department?.name ?? "").toLowerCase().includes(q))
      : positions;
  }, [positions, posSearch]);

  const [delDept, setDelDept] = useState<DepartmentRow | null>(null);
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

  return (
    <Tabs
      value={initialTab}
      onValueChange={(v) => router.replace(`/organization?tab=${v}`, { scroll: false })}
      className="space-y-4"
    >
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
          <OrgChart departments={departments} companyName={user.company?.name} />
        )}
      </TabsContent>

      {/* Departments */}
      <TabsContent value="departments" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={deptSearch} onChange={(e) => setDeptSearch(e.target.value)} placeholder="ค้นหาชื่อหรือรหัสฝ่าย" aria-label="ค้นหาฝ่าย" className="pl-8" />
          </div>
          {canCreate && (
            <Button size="sm" render={<Link href="/organization/departments/new" />}>
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
        ) : deptRows.length === 0 ? (
          <EmptyState icon={Building2} title="ไม่พบฝ่าย" description="ลองเปลี่ยนคำค้นหา" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 text-center">No.</TableHead>
                <TableHead className="w-full">ฝ่าย / แผนก</TableHead>
                <TableHead>รหัส</TableHead>
                <TableHead className="text-center">พนักงาน</TableHead>
                {(canUpdate || canDelete) && <TableHead className="text-center">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {deptRows.map(({ node, depth }, i) => (
                <TableRow key={node.id}>
                  <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex items-center gap-2" style={{ paddingLeft: depth * 20 }}>
                      {depth > 0 ? (
                        <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <Building2 className="size-4 shrink-0 text-primary" />
                      )}
                      {canUpdate ? (
                        <Link href={`/organization/departments/${node.id}/edit`} className={`break-words hover:text-primary hover:underline ${depth === 0 ? "font-medium" : ""}`}>
                          {node.name}
                        </Link>
                      ) : (
                        <span className={`break-words ${depth === 0 ? "font-medium" : ""}`}>{node.name}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{node.code}</TableCell>
                  <TableCell className="text-center tabular-nums">{node.employeeCount}</TableCell>
                  {(canUpdate || canDelete) && (
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {canUpdate && (
                          <Button variant="ghost" size="icon" className="size-9" render={<Link href={`/organization/departments/${node.id}/edit`} />} aria-label={`แก้ไข ${node.name}`}>
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" className="size-9 text-destructive" onClick={() => setDelDept(node)} aria-label={`ลบ ${node.name}`}>
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      {/* Positions */}
      <TabsContent value="positions" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={posSearch} onChange={(e) => setPosSearch(e.target.value)} placeholder="ค้นหาตำแหน่ง รหัส หรือฝ่าย" aria-label="ค้นหาตำแหน่ง" className="pl-8" />
          </div>
          {canCreate && (
            <Button size="sm" render={<Link href="/organization/positions/new" />}>
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
        ) : posRows.length === 0 ? (
          <EmptyState icon={Briefcase} title="ไม่พบตำแหน่ง" description="ลองเปลี่ยนคำค้นหา" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 text-center">No.</TableHead>
                <TableHead className="w-full">ตำแหน่ง</TableHead>
                <TableHead>ระดับ</TableHead>
                <TableHead>รหัส</TableHead>
                <TableHead>ฝ่าย / แผนก</TableHead>
                <TableHead className="text-center">พนักงาน</TableHead>
                {(canUpdate || canDelete) && <TableHead className="text-center">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {posRows.map((p, i) => (
                <TableRow key={p.id}>
                  <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                  <TableCell className="whitespace-normal">
                    {canUpdate ? (
                      <Link href={`/organization/positions/${p.id}/edit`} className="font-medium break-words hover:text-primary hover:underline">
                        {p.title}
                      </Link>
                    ) : (
                      <span className="font-medium break-words">{p.title}</span>
                    )}
                  </TableCell>
                  <TableCell>{levelLabel(p.level)}</TableCell>
                  <TableCell className="tabular-nums">{p.code}</TableCell>
                  <TableCell>{p.department?.name ?? "-"}</TableCell>
                  <TableCell className="text-center tabular-nums">{p.employeeCount}</TableCell>
                  {(canUpdate || canDelete) && (
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {canUpdate && (
                          <Button variant="ghost" size="icon" className="size-9" render={<Link href={`/organization/positions/${p.id}/edit`} />} aria-label={`แก้ไข ${p.title}`}>
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" className="size-9 text-destructive" onClick={() => setDelPos(p)} aria-label={`ลบ ${p.title}`}>
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TabsContent>

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
