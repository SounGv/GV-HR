"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SortingState } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";

import { getEmployeeColumns } from "./employee-columns";
import { EmployeeFormSheet } from "./employee-form-sheet";
import { useEmployees, useEmployee, useOrgOptions, useDeleteEmployee } from "./hooks";
import { EMPLOYEE_STATUSES } from "./schema";
import { STATUS_LABEL } from "./labels";
import type { EmployeeListItem, EmployeeStatus } from "./types";

const PAGE_SIZE = 20;
const ALL = "ALL";

export function EmployeeTable() {
  const router = useRouter();
  const { can } = useAuth();
  const canCreate = can("employee:create");
  const canEdit = can("employee:update");
  const canDelete = can("employee:delete");

  // Query state
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const query = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      departmentId: departmentId === ALL ? undefined : departmentId,
      status: status === ALL ? undefined : (status as EmployeeStatus),
      sortBy: sorting[0]?.id,
      sortDir: sorting[0] ? ((sorting[0].desc ? "desc" : "asc") as "asc" | "desc") : undefined,
    }),
    [page, search, departmentId, status, sorting],
  );

  const { data, isLoading, isError, refetch, isFetching } = useEmployees(query);
  const { data: orgData } = useOrgOptions();
  const deleteMutation = useDeleteEmployee();

  // Create / edit sheet
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const editQuery = useEmployee(editId ?? undefined);
  const sheetOpen = createOpen || (!!editId && !!editQuery.data);
  const sheetEmployee = editId ? (editQuery.data?.data ?? null) : null;

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<EmployeeListItem | null>(null);

  const columns = useMemo(
    () =>
      getEmployeeColumns({
        onView: (row) => router.push(`/employees/${row.id}`),
        onEdit: (row) => {
          setCreateOpen(false);
          setEditId(row.id);
        },
        onDelete: (row) => setDeleteTarget(row),
        canEdit,
        canDelete,
      }),
    [router, canEdit, canDelete],
  );

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("ลบพนักงานเรียบร้อย");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  const filters = (
    <>
      <Select
        value={departmentId}
        onValueChange={(v) => {
          setDepartmentId(v ?? ALL);
          setPage(1);
        }}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="ทุกแผนก" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>ทุกแผนก</SelectItem>
          {(orgData?.data.departments ?? []).map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={status}
        onValueChange={(v) => {
          setStatus(v ?? ALL);
          setPage(1);
        }}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="ทุกสถานะ" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>ทุกสถานะ</SelectItem>
          {EMPLOYEE_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {canCreate && (
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> เพิ่มพนักงาน
        </Button>
      )}
    </>
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        error={isError}
        onRetry={() => refetch()}
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.meta.total ?? 0}
        onPageChange={setPage}
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="ค้นหาชื่อ, รหัส, อีเมล…"
        sorting={sorting}
        onSortingChange={setSorting}
        toolbar={filters}
        onRowClick={(row) => router.push(`/employees/${row.id}`)}
        emptyTitle="ยังไม่มีพนักงาน"
        emptyDescription={
          canCreate ? "เริ่มต้นด้วยการเพิ่มพนักงานคนแรก" : "ยังไม่มีข้อมูลพนักงานในระบบ"
        }
      />

      {/* subtle background-refetch hint */}
      {isFetching && !isLoading && (
        <div className="pointer-events-none fixed right-4 bottom-4 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground opacity-80">
          กำลังอัปเดต…
        </div>
      )}

      <EmployeeFormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditId(null);
          }
        }}
        employee={sheetEmployee}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="ยืนยันการลบพนักงาน"
        description={
          deleteTarget
            ? `ต้องการลบ ${deleteTarget.firstName} ${deleteTarget.lastName} (${deleteTarget.employeeCode}) ใช่หรือไม่? ข้อมูลจะถูกซ่อนออกจากระบบ`
            : undefined
        }
        destructive
        confirmLabel="ลบ"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
