"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, X, CalendarClock, MapPin, FileText, UserRound } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { useAuth } from "@/features/auth/auth-context";
import { formatDateTime, fullName, getInitials } from "@/lib/format";
import { ApiError } from "@/lib/api/client";

import { useCancelMeeting, useMeeting, useRespondToMeeting } from "./hooks";
import { MeetingStatusBadge, ResponseStatusBadge } from "./labels";

export function MeetingDetailView({ id }: { id: string }) {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useMeeting(id);
  const cancelMut = useCancelMeeting();
  const respondMut = useRespondToMeeting();
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (isLoading) return <TableLoadingState rows={3} />;
  if (isError || !data?.data) return <ErrorState onRetry={() => refetch()} />;

  const meeting = data.data;
  const isOrganizer = meeting.organizer.id === user.employee?.id;
  const canRespond = meeting.status === "SCHEDULED" && meeting.myResponse === "PENDING";
  const canCancel = meeting.status === "SCHEDULED" && isOrganizer;

  async function respond(action: "accept" | "decline") {
    try {
      await respondMut.mutateAsync({ id, action });
      toast.success(action === "accept" ? "ตอบรับการประชุมแล้ว" : "ปฏิเสธการประชุมแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  async function confirmCancelMeeting() {
    try {
      await cancelMut.mutateAsync(id);
      toast.success("ยกเลิกการประชุมแล้ว");
      setConfirmCancel(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ยกเลิกไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "นัดประชุม", href: "/meetings" }, { label: meeting.title }]}
        backHref="/meetings"
        title={meeting.title}
        description={`นัดโดย ${meeting.organizer.firstName} ${meeting.organizer.lastName}`}
        status={<MeetingStatusBadge status={meeting.status} />}
        actions={
          canCancel ? (
            <Button variant="outline" className="text-destructive" onClick={() => setConfirmCancel(true)}>
              ยกเลิกการประชุม
            </Button>
          ) : undefined
        }
      />

      {canRespond && (
        <Card className="border-primary/40 bg-accent">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm font-medium text-accent-foreground">คุณได้รับเชิญเข้าร่วมการประชุมนี้ — กรุณาตอบรับ</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={respondMut.isPending} onClick={() => respond("decline")}>
                <X className="size-4" /> ปฏิเสธ
              </Button>
              <Button size="sm" disabled={respondMut.isPending} onClick={() => respond("accept")}>
                <Check className="size-4" /> ตอบรับ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดการประชุม</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoRow icon={CalendarClock} label="เวลา" value={`${formatDateTime(meeting.startAt)} – ${formatDateTime(meeting.endAt)}`} />
            {meeting.location && <InfoRow icon={MapPin} label="สถานที่" value={meeting.location} />}
          </div>
          {meeting.description && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="size-4" /> วาระการประชุม
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{meeting.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ผู้เข้าร่วม ({meeting.attendees.length} คน)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <UserRound className="size-4" /> {meeting.organizer.firstName} {meeting.organizer.lastName}
            </span>
            <span className="text-xs text-muted-foreground">ผู้นัดประชุม</span>
          </div>
          {meeting.attendees.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <Avatar className="size-7">
                  {a.employee.avatarUrl && <AvatarImage src={a.employee.avatarUrl} alt={a.employee.firstName} />}
                  <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
                    {getInitials(a.employee.firstName, a.employee.lastName)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{fullName(a.employee.firstName, a.employee.lastName)}</span>
              </span>
              <ResponseStatusBadge status={a.status} />
            </div>
          ))}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="ยกเลิกการประชุม"
        description={`ต้องการยกเลิก "${meeting.title}" ใช่หรือไม่? ผู้เข้าร่วมทุกคนจะได้รับการแจ้งเตือน`}
        destructive
        confirmLabel="ยกเลิกการประชุม"
        cancelLabel="ปิด"
        loading={cancelMut.isPending}
        onConfirm={confirmCancelMeeting}
      />
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="size-4" />}
        {label}
      </span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
