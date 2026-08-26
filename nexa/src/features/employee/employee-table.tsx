"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { SortingState } from "@tanstack/react-table";
import { Plus, Download, Loader2 } from "lucide-react";
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
import { toCsv, downloadCsv } from "@/lib/csv";

import { fetchEmployees } from "./api";
import { getEmployeeColumns } from "./employee-columns";
import { useEmployees, useOrgOptions, useDeleteEmployee } from "./hooks";
import { EMPLOYEE_STATUSES, EMPLOYMENT_TYPES } from "./schema";
import { STATUS_LABEL, EMPLOYMENT_LABEL } from "./labels";
import type { EmployeeListItem, EmployeeQuery, EmployeeStatus, EmploymentType } from "./types";

const EXPORT_COLUMNS = [
  { key: "employeeCode", label: "รหัสพนักงาน" },
  { key: "name", label: "ชื่อ-นามสกุล" },
  { key: "nickname", label: "ชื่อเล่น" },
  { key: "department", label: "แผนก" },
  { key: "position", label: "ตำแหน่ง" },
  { key: "branch", label: "สาขา" },
  { key: "employmentType", label: "ประเภทการจ้าง" },
  { key: "status", label: "สถานะ" },
  { key: "hireDate", label: "วันเริ่มงาน" },
  { key: "email", label: "อีเมล" },
  { key: "phone", label: "เบอร์โทร" },
];

/** Page through the full filtered result set (server caps pageSize at 100). */
async function fetchAllEmployees(query: EmployeeQuery): Promise<EmployeeListItem[]> {
  const first = await fetchEmployees({ ...query, page: 1, pageSize: 100 });
  const all = [...first.data];
  const totalPages = first.meta.totalPages;
  for (let page = 2; page <= totalPages; page++) {
    const next = await fetchEmployees({ ...query, page, pageSize: 100 });
    all.push(...next.data);
  }
  return all;
}

const PAGE_SIZE = 20;
const ALL = "ALL";

export function EmployeeTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useAuth();
  const canCreate = can("employee:create");
  const canEdit = can("employee:update");
  const canDelete = can("employee:delete");
  const canExport = can("employee:export");

  // Query state — employmentType can arrive pre-set via ?employmentType=
  // (e.g. the dashboard's "พนักงานรายวัน" quick-access tile links straight
  // into a filtered view instead of landing on the unfiltered list).
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [employmentType, setEmploymentType] = useState<string>(
    () => searchParams.get("employmentType") ?? ALL,
  );
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [isExporting, setIsExporting] = useState(false);

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
      employmentType: employmentType === ALL ? undefined : (employmentType as EmploymentType),
      sortBy: sorting[0]?.id,
      sortDir: sorting[0] ? ((sorting[0].desc ? "desc" : "asc") as "asc" | "desc") : undefined,
    }),
    [page, search, departmentId, status, employmentType, sorting],
  );

  const { data, isLoading, isError, refetch, isFetching } = useEmployees(query);
  const { data: orgData } = useOrgOptions();
  const deleteMutation = useDeleteEmployee();

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<EmployeeListItem | null>(null);

  const columns = useMemo(
    () =>
      getEmployeeColumns({
        onView: (row) => router.push(`/employees/${row.id}`),
        onEdit: (row) => router.push(`/employees/${row.id}/edit`),
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

  async function handleExport() {
    setIsExporting(true);
    try {
      const rows = await fetchAllEmployees(query);
      const csv = toCsv(
        EXPORT_COLUMNS,
        rows.map((e) => ({
          employeeCode: e.employeeCode,
          name: `${e.firstName} ${e.lastName}`,
          nickname: e.nickname ?? "",
          department: e.department?.name ?? "",
          position: e.position?.title ?? "",
          branch: e.branch?.name ?? "",
          employmentType: EMPLOYMENT_LABEL[e.employmentType],
          status: STATUS_LABEL[e.status],
          hireDate: e.hireDate ?? "",
          email: e.email ?? "",
          phone: e.phone ?? "",
        })),
      );
      downloadCsv(`employees-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      toast.success(`ส่งออกพนักงาน ${rows.length} คนเรียบร้อย`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ส่งออกไม่สำเร็จ");
    } finally {
      setIsExporting(false);
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
        <SelectContent alignItemWithTrigger={false}>
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
        <SelectContent alignItemWithTrigger={false}>
          <SelectItem value={ALL}>ทุกสถานะ</SelectItem>
          {EMPLOYEE_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={employmentType}
        onValueChange={(v) => {
          setEmploymentType(v ?? ALL);
          setPage(1);
        }}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="ทุกประเภทการจ้าง" />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectItem value={ALL}>ทุกประเภทการจ้าง</SelectItem>
          {EMPLOYMENT_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {EMPLOYMENT_LABEL[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {canExport && (
        <Button variant="outline" onClick={handleExport} disabled={isExporting}>
          {isExporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          ส่งออก
        </Button>
      )}

      {canCreate && (
        <Button render={<Link href="/employees/new" />}>
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
