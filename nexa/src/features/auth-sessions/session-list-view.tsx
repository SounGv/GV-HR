"use client";

import { useState } from "react";
import { Laptop, LogOut, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { ApiError } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { useRevokeOtherSessions, useRevokeSession, useSessions } from "./hooks";
import type { SessionRow } from "./types";

function parseDevice(ua: string | null): string {
  if (!ua) return "ไม่ทราบอุปกรณ์";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua) && !/Chrome/.test(ua)
          ? "Safari"
          : "เบราว์เซอร์อื่น";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}

export function SessionListView() {
  const { data, isLoading, isError, refetch } = useSessions();
  const revokeMut = useRevokeSession();
  const revokeOthersMut = useRevokeOtherSessions();
  const [confirmOthersOpen, setConfirmOthersOpen] = useState(false);
  const sessions = data?.data ?? [];
  const otherCount = sessions.filter((s) => !s.isCurrent).length;

  async function revoke(row: SessionRow) {
    try {
      await revokeMut.mutateAsync(row.id);
      toast.success("ออกจากระบบอุปกรณ์นั้นแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  async function confirmRevokeOthers() {
    try {
      await revokeOthersMut.mutateAsync();
      toast.success("ออกจากระบบอุปกรณ์อื่นทั้งหมดแล้ว");
      setConfirmOthersOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">อุปกรณ์ที่เข้าสู่ระบบ</p>
          <p className="text-xs text-muted-foreground">ประวัติการเข้าสู่ระบบและอุปกรณ์ที่ยังใช้งานอยู่</p>
        </div>
        {otherCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => setConfirmOthersOpen(true)}>
            <LogOut className="size-4" /> ออกจากอุปกรณ์อื่นทั้งหมด
          </Button>
        )}
      </div>

      {isLoading ? (
        <TableLoadingState rows={2} />
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
            >
              <div className="flex min-w-0 items-center gap-3">
                {s.isCurrent ? (
                  <MonitorSmartphone className="size-4 shrink-0 text-primary" />
                ) : (
                  <Laptop className="size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{parseDevice(s.userAgent)}</span>
                    {s.isCurrent && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        อุปกรณ์นี้
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.createdIp ?? "ไม่ทราบ IP"} · เข้าสู่ระบบเมื่อ {formatDateTime(s.createdAt)}
                  </p>
                </div>
              </div>
              {!s.isCurrent && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-xs text-destructive"
                  disabled={revokeMut.isPending}
                  onClick={() => revoke(s)}
                >
                  ออกจากระบบ
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmOthersOpen}
        onOpenChange={setConfirmOthersOpen}
        title="ออกจากอุปกรณ์อื่นทั้งหมด?"
        description={`อุปกรณ์อื่น ${otherCount} เครื่องจะถูกออกจากระบบ ต้องเข้าสู่ระบบใหม่อีกครั้ง`}
        destructive
        confirmLabel="ออกจากระบบ"
        loading={revokeOthersMut.isPending}
        onConfirm={confirmRevokeOthers}
      />
    </Card>
  );
}
