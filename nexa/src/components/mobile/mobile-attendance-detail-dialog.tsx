"use client";

import { Camera, Clock3, MapPin, Navigation, StickyNote } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AttendanceStatusBadge, WORK_MODE_LABEL } from "@/features/attendance/status-badge";
import type { AttendanceRecord } from "@/features/attendance/types";

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso),
  );
}

function fmtTime(iso: string | null) {
  if (!iso) return "--:--";
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(
    new Date(iso),
  );
}

function Punch({
  label,
  at,
  lat,
  lng,
  distance,
  photoUrl,
}: {
  label: string;
  at: string | null;
  lat: number | null;
  lng: number | null;
  distance: number | null;
  photoUrl: string | null;
}) {
  if (!at) return null;
  return (
    <div className="flex gap-3 rounded-xl border border-border p-3">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={label} className="size-16 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Camera className="size-5" />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Clock3 className="size-3.5" /> {label} · {fmtTime(at)}
        </p>
        {lat != null && lng != null ? (
          <p className="flex items-center gap-1.5">
            <MapPin className="size-3.5" /> {lat.toFixed(5)}, {lng.toFixed(5)}
          </p>
        ) : (
          <p className="flex items-center gap-1.5">
            <MapPin className="size-3.5" /> ไม่มีข้อมูล GPS
          </p>
        )}
        {distance != null && (
          <p className="flex items-center gap-1.5">
            <Navigation className="size-3.5" /> ห่างจากสาขา {Math.round(distance)} ม.
          </p>
        )}
      </div>
    </div>
  );
}

export function MobileAttendanceDetailDialog({
  record,
  open,
  onOpenChange,
}: {
  record: AttendanceRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {record && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {fmtDate(record.workDate)}
                <AttendanceStatusBadge status={record.status} />
              </DialogTitle>
              <DialogDescription>{WORK_MODE_LABEL[record.workMode]}</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Punch
                label="เช็คอิน"
                at={record.clockInAt}
                lat={record.clockInLat}
                lng={record.clockInLng}
                distance={record.clockInDistance}
                photoUrl={record.clockInPhotoUrl}
              />
              <Punch
                label="เช็คเอาท์"
                at={record.clockOutAt}
                lat={record.clockOutLat}
                lng={record.clockOutLng}
                distance={record.clockOutDistance}
                photoUrl={record.clockOutPhotoUrl}
              />
            </div>

            {record.note && (
              <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm">
                <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="whitespace-pre-line text-foreground">{record.note}</p>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
