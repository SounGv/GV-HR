"use client";

import Link from "next/link";
import { Bell, CheckCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusChip } from "@/components/shared/status-chip";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";
import { useMarkNotificationsRead, useNotifications } from "./hooks";

export function NotificationListView() {
  const { can } = useAuth();
  const { data, isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationsRead();

  const feed = data?.data;
  const items = feed?.items ?? [];
  const unread = feed?.unread ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {unread > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => markRead.mutate(undefined)}
            disabled={markRead.isPending}
          >
            <CheckCheck className="size-3.5" />
            อ่านทั้งหมด ({unread})
          </Button>
        ) : (
          <span />
        )}
        {can("notification:create") && (
          <Button size="sm" className="gap-1.5" render={<Link href="/notifications/new" />}>
            <Send className="size-3.5" />
            ส่งแจ้งเตือน
          </Button>
        )}
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={4} />
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title="ยังไม่มีการแจ้งเตือน" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-center">No.</TableHead>
              <TableHead>วันที่</TableHead>
              <TableHead>หัวข้อ</TableHead>
              <TableHead className="w-full">รายละเอียด</TableHead>
              <TableHead className="text-center">สถานะ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((n, i) => {
              // Following the link (or just opening a link-less one) is itself
              // the acknowledgment: mark it read right then instead of
              // leaving the badge stuck until "อ่านทั้งหมด".
              const onOpen = () => {
                if (!n.read) markRead.mutate(n.id);
              };
              const titleClass = cn("text-left font-medium break-words hover:text-primary hover:underline", n.read ? "text-muted-foreground" : "text-foreground");
              return (
                <TableRow key={n.id} className={n.read ? undefined : "bg-primary/5"}>
                  <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(n.createdAt)}</TableCell>
                  <TableCell className="min-w-48 whitespace-normal">
                    {n.link ? (
                      <Link href={n.link} onClick={onOpen} className={titleClass}>
                        {n.title}
                      </Link>
                    ) : n.read ? (
                      <span className={titleClass}>{n.title}</span>
                    ) : (
                      <button type="button" onClick={onOpen} className={titleClass}>
                        {n.title}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="min-w-64 whitespace-normal text-muted-foreground">{n.body}</TableCell>
                  <TableCell className="text-center">
                    <StatusChip tone={n.read ? "neutral" : "primary"} label={n.read ? "อ่านแล้ว" : "ยังไม่อ่าน"} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
