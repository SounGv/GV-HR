"use client";

import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useMarkNotificationsRead, useNotifications } from "./hooks";

export function NotificationListView() {
  const { data, isLoading } = useNotifications();
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

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <Bell className="size-8 opacity-40" />
          <p className="text-sm">ยังไม่มีการแจ้งเตือน</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {items.map((n) => (
            <li key={n.id} className={`px-4 py-3 ${n.read ? "" : "bg-primary/5"}`}>
              <div className="flex items-start gap-2.5">
                {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                <div className={n.read ? "min-w-0 flex-1 pl-4" : "min-w-0 flex-1"}>
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">{formatDate(n.createdAt)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
