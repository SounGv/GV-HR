"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pin, Pencil, Trash2, Megaphone } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusChip } from "@/components/shared/status-chip";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";

import { useAnnouncements, useDeleteAnnouncement } from "./hooks";
import type { Announcement } from "./types";

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(iso));
}

export function AnnouncementView() {
  const { can } = useAuth();
  const canManage = can("announcement:create");

  return (
    <Tabs defaultValue="feed" className="space-y-4">
      <TabsList>
        <TabsTrigger value="feed">ประกาศ</TabsTrigger>
        {canManage && <TabsTrigger value="manage">จัดการประกาศ</TabsTrigger>}
      </TabsList>

      <TabsContent value="feed">
        <Feed />
      </TabsContent>

      {canManage && (
        <TabsContent value="manage">
          <Manage />
        </TabsContent>
      )}
    </Tabs>
  );
}

function Feed() {
  const { data, isLoading, isError, refetch } = useAnnouncements("feed");
  const items = data?.data ?? [];

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={3} />;
  if (items.length === 0) {
    return <EmptyState icon={Megaphone} title="ยังไม่มีประกาศ" description="ประกาศจากองค์กรจะแสดงที่นี่" />;
  }

  return (
    <div className="space-y-3">
      {items.map((a) => (
        <Link key={a.id} href={`/announcements/${a.id}`}>
          <Card className={cn("gap-2 p-5", a.pinned && "border-primary/40 bg-primary/[0.03]")}>
            <div className="flex items-center gap-2">
              {a.pinned && <Pin className="size-4 text-primary" />}
              <h3 className="font-semibold text-foreground">{a.title}</h3>
            </div>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
            <p className="text-xs text-muted-foreground">
              {a.authorName ? `โดย ${a.authorName} · ` : ""}
              {fmtDate(a.publishedAt ?? a.createdAt)}
            </p>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function Manage() {
  const { data, isLoading, isError, refetch } = useAnnouncements("manage");
  const deleteMut = useDeleteAnnouncement();
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const items = data?.data ?? [];

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast.success("ลบประกาศเรียบร้อย");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">ประกาศทั้งหมด</h2>
        <Button render={<Link href="/announcements/new" />}>
          <Plus className="size-4" /> สร้างประกาศ
        </Button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={4} />
      ) : items.length === 0 ? (
        <EmptyState icon={Megaphone} title="ยังไม่มีประกาศ" description="เริ่มต้นด้วยการสร้างประกาศแรก" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-center">No.</TableHead>
              <TableHead>วันที่</TableHead>
              <TableHead className="w-full">หัวข้อประกาศ</TableHead>
              <TableHead className="text-center">สถานะ</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((a, i) => (
              <TableRow key={a.id}>
                <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                <TableCell className="tabular-nums">{fmtDate(a.publishedAt ?? a.createdAt) || "-"}</TableCell>
                <TableCell className="min-w-56 whitespace-normal">
                  <div className="flex items-center gap-2">
                    {a.pinned && <Pin className="size-3.5 shrink-0 text-primary" aria-label="ปักหมุด" />}
                    <Link href={`/announcements/${a.id}`} className="font-medium break-words text-foreground hover:text-primary hover:underline">
                      {a.title}
                    </Link>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{a.body}</p>
                </TableCell>
                <TableCell className="text-center">
                  <StatusChip tone={a.status === "PUBLISHED" ? "success" : "neutral"} label={a.status === "PUBLISHED" ? "เผยแพร่" : "ฉบับร่าง"} />
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="icon" className="size-9" aria-label={`แก้ไข ${a.title}`} render={<Link href={`/announcements/${a.id}/edit`} />}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-9" aria-label={`ลบ ${a.title}`} onClick={() => setDeleteTarget(a)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="ลบประกาศ"
        description={deleteTarget ? `ต้องการลบ "${deleteTarget.title}" ใช่หรือไม่?` : undefined}
        destructive
        confirmLabel="ลบ"
        loading={deleteMut.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
