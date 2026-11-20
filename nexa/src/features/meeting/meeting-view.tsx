"use client";

import Link from "next/link";
import { Plus, Presentation } from "lucide-react";

import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger, stickyTabsRow } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, NoEmployeeState, TableLoadingState } from "@/components/shared/states";
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
      <div className={cn("flex items-center justify-between gap-3", stickyTabsRow)}>
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
  const hasEmployee = !!useAuth().user.employee;
  const { data, isLoading, isError, error, refetch } = useMeetings(scope);
  const meetings = data?.data ?? [];

  if (!hasEmployee) return <NoEmployeeState />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14 text-center">ลำดับ</TableHead>
          <TableHead>วันและเวลา</TableHead>
          <TableHead className="w-full">เรื่องประชุม</TableHead>
          <TableHead>สถานที่</TableHead>
          <TableHead className="text-center">ผู้เข้าร่วม</TableHead>
          {scope === "organizer" && <TableHead className="text-center">ตอบรับแล้ว</TableHead>}
          {scope === "organizer" && <TableHead>ผู้จัด</TableHead>}
          <TableHead className="text-center">สถานะ</TableHead>
          {scope === "invitee" && <TableHead className="text-center">การตอบรับของฉัน</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {meetings.map((m, i) => (
          <TableRow key={m.id}>
            <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
            <TableCell className="tabular-nums">{timeRange(m)}</TableCell>
            <TableCell className="min-w-48 whitespace-normal">
              <Link href={`/meetings/${m.id}`} className="font-medium break-words text-foreground hover:text-primary hover:underline">
                {m.title}
              </Link>
            </TableCell>
            <TableCell>{m.location || "-"}</TableCell>
            <TableCell className="text-center tabular-nums">{m.attendees.length}</TableCell>
            {scope === "organizer" && (
              <TableCell className="text-center tabular-nums">
                {m.attendees.filter((a) => a.status === "ACCEPTED").length}/{m.attendees.length}
              </TableCell>
            )}
            {scope === "organizer" && (
              <TableCell>
                {m.organizer.firstName} {m.organizer.lastName}
              </TableCell>
            )}
            <TableCell className="text-center">
              <MeetingStatusBadge status={m.status} />
            </TableCell>
            {scope === "invitee" && (
              <TableCell className="text-center">{m.myResponse ? <ResponseStatusBadge status={m.myResponse} /> : "-"}</TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
