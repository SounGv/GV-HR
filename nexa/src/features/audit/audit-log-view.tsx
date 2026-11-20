"use client";

import { auditActionLabel, auditEntityLabel } from "@/lib/audit-label";
import { useState } from "react";
import { ChevronLeft, ChevronRight, History } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { formatDateTime } from "@/lib/format";
import { useAuditEntities, useAuditLogs } from "./hooks";

const PAGE_SIZE = 20;

export function AuditLogView() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: entitiesData } = useAuditEntities();
  const entities = entitiesData?.data ?? [];

  const { data, isLoading, isError, refetch } = useAuditLogs({
    page,
    pageSize: PAGE_SIZE,
    entity: entity || undefined,
    action: action || undefined,
    from: from || undefined,
    to: to || undefined,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;

  function resetToFirstPage() {
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">ประเภทข้อมูล</label>
          <Select
            value={entity || "__all"}
            onValueChange={(v) => {
              setEntity(v === "__all" ? "" : (v ?? ""));
              resetToFirstPage();
            }}
          >
            <SelectTrigger className="min-w-[160px] w-auto max-w-[320px]">
              <SelectValue placeholder="ทั้งหมด" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">ทั้งหมด</SelectItem>
              {entities.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">การกระทำ</label>
          <Input
            placeholder="เช่น employee.create"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              resetToFirstPage();
            }}
            className="w-48"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">จากวันที่</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              resetToFirstPage();
            }}
            className="w-40"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">ถึงวันที่</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              resetToFirstPage();
            }}
            className="w-40"
          />
        </div>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={8} />
      ) : rows.length === 0 ? (
        <EmptyState icon={History} title="ไม่พบบันทึกการใช้งาน" description="ลองปรับตัวกรองใหม่" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 text-center">ลำดับ</TableHead>
                <TableHead>วันเวลา</TableHead>
                <TableHead className="w-full">การกระทำ</TableHead>
                <TableHead>ประเภทข้อมูล</TableHead>
                <TableHead>ผู้ทำรายการ</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell className="text-center tabular-nums">{((meta?.page ?? 1) - 1) * PAGE_SIZE + i + 1}</TableCell>
                  <TableCell className="tabular-nums">{formatDateTime(r.createdAt)}</TableCell>
                  <TableCell className="font-medium whitespace-normal text-foreground">
                    {auditActionLabel(r.action)}
                    <span className="block text-xs font-normal break-all text-muted-foreground">{r.action}</span>
                  </TableCell>
                  <TableCell>{auditEntityLabel(r.entity)}</TableCell>
                  <TableCell>
                    {r.actor
                      ? r.actor.email
                        ? `${r.actor.name ?? r.actor.email} (${r.actor.email})`
                        : (r.actor.name ?? `@${r.actor.username}`)
                      : "ระบบ"}
                  </TableCell>
                  <TableCell className="tabular-nums">{r.ip || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                หน้า {meta.page} จาก {meta.totalPages} · ทั้งหมด {meta.total} รายการ
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4" /> ก่อนหน้า
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                >
                  ถัดไป <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
