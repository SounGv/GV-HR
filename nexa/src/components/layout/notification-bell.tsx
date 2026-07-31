"use client";

import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDate } from "@/lib/format";
import { useNotifications, useMarkNotificationsRead } from "@/features/notification/hooks";

export function NotificationBell() {
  const { data } = useNotifications();
  const markRead = useMarkNotificationsRead();

  const feed = data?.data;
  const items = feed?.items ?? [];
  const unread = feed?.unread ?? 0;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label="การแจ้งเตือน">
            <Bell className="size-4" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white ring-2 ring-background">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">การแจ้งเตือน</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={() => markRead.mutate()}
              disabled={markRead.isPending}
            >
              <CheckCheck className="size-3.5" />
              อ่านทั้งหมด
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            ยังไม่มีการแจ้งเตือน
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`px-3 py-2.5 ${n.read ? "" : "bg-primary/5"}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                    <div className={n.read ? "flex-1 pl-4" : "flex-1"}>
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground/70">
                        {formatDate(n.createdAt)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
