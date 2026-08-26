"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, History } from "lucide-react";

import { Card } from "@/components/ui/card";
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
            <SelectTrigger className="w-40">
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
          <Card className="divide-y divide-border p-0">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{r.action}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {r.entity}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.actor
                      ? r.actor.email
                        ? `${r.actor.name ?? r.actor.email} (${r.actor.email})`
                        : (r.actor.name ?? `@${r.actor.username}`)
                      : "ระบบ"}
                    {r.ip ? ` · ${r.ip}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
              </div>
            ))}
          </Card>

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
