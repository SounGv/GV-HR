"use client";

import Link from "next/link";
import { Plus, Users, MapPin, Presentation } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { useAuth } from "@/features/auth/auth-context";

import { useMeetings } from "./hooks";
import { MeetingStatusBadge, ResponseStatusBadge } from "./labels";
import type { MeetingListItem } from "./types";

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

function timeRange(m: MeetingListItem) {
  const start = new Date(m.startAt);
  const end = new Date(m.endAt);
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    const day = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(start);
    const t = (d: Date) => new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" }).format(d);
    return `${day} · ${t(start)}–${t(end)} น.`;
  }
  return `${fmtDateTime(m.startAt)} – ${fmtDateTime(m.endAt)} น.`;
}

export function MeetingView() {
  const { can } = useAuth();
  const canCreate = can("meeting:create");

  return (
    <Tabs defaultValue="invitee" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="invitee">คำเชิญของฉัน</TabsTrigger>
          {canCreate && <TabsTrigger value="organizer">ที่ฉันสร้าง</TabsTrigger>}
        </TabsList>
        {canCreate && (
          <Button render={<Link href="/meetings/new" />}>
            <Plus className="size-4" /> นัดประชุมใหม่
          </Button>
        )}
      </div>

      <TabsContent value="invitee" className="space-y-2">
        <MeetingList scope="invitee" />
      </TabsContent>

      {canCreate && (
        <TabsContent value="organizer" className="space-y-2">
          <MeetingList scope="organizer" />
        </TabsContent>
      )}
    </Tabs>
  );
}

function MeetingList({ scope }: { scope: "organizer" | "invitee" }) {
  const { data, isLoading, isError, refetch } = useMeetings(scope);
  const meetings = data?.data ?? [];

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={4} />;
  if (meetings.length === 0) {
    return (
      <EmptyState
        icon={Presentation}
        title={scope === "organizer" ? "ยังไม่มีการประชุมที่คุณสร้าง" : "ยังไม่มีคำเชิญเข้าร่วมประชุม"}
        description={scope === "organizer" ? "เริ่มต้นด้วยการนัดประชุมใหม่" : "คำเชิญเข้าร่วมประชุมจะแสดงที่นี่"}
      />
    );
  }

  return (
    <div className="space-y-2">
      {meetings.map((m) => (
        <Card key={m.id} className="p-4">
          <Link href={`/meetings/${m.id}`} className="block space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{m.title}</span>
                  <MeetingStatusBadge status={m.status} />
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{timeRange(m)}</p>
              </div>
              {scope === "invitee" && m.myResponse && <ResponseStatusBadge status={m.myResponse} />}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              {m.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" /> {m.location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="size-3.5" /> {m.attendees.length} ผู้เข้าร่วม
                {scope === "organizer" &&
                  ` · ตอบรับแล้ว ${m.attendees.filter((a) => a.status === "ACCEPTED").length}/${m.attendees.length}`}
              </span>
              {scope === "organizer" && (
                <span>โดย {m.organizer.firstName} {m.organizer.lastName}</span>
              )}
            </div>
          </Link>
        </Card>
      ))}
    </div>
  );
}
