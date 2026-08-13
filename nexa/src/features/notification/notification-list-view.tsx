"use client";

import Link from "next/link";
import { Bell, CheckCheck, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { formatDate } from "@/lib/format";
import { useMarkNotificationsRead, useNotifications } from "./hooks";

export function NotificationListView() {
  const { data, isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationsRead();

  const feed = data?.data;
  const items = feed?.items ?? [];
  const unread = feed?.unread ?? 0;

  return (
    <div className="space-y-3">
      {unread > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => markRead.mutate()}
          disabled={markRead.isPending}
        >
          <CheckCheck className="size-3.5" />
          อ่านทั้งหมด ({unread})
        </Button>
      )}

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={4} />
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title="ยังไม่มีการแจ้งเตือน" />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {items.map((n) => {
            const body = (
              <div className="flex items-start gap-2.5">
                {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                <div className={n.read ? "min-w-0 flex-1 pl-4" : "min-w-0 flex-1"}>
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">{formatDate(n.createdAt)}</p>
                </div>
                {n.link && <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />}
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} className={`block px-4 py-3 transition hover:bg-muted/60 ${n.read ? "" : "bg-primary/5"}`}>
                {body}
              </Link>
            ) : (
              <li key={n.id} className={`px-4 py-3 ${n.read ? "" : "bg-primary/5"}`}>
                {body}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
