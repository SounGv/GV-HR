"use client";

import { useState, type ReactNode } from "react";
import { LocateFixed, Save, Loader2, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { getCurrentPosition } from "@/lib/geolocation";
import { ApiError } from "@/lib/api/client";
import { useGeofences, useUpdateGeofence } from "./hooks";
import type { Geofence } from "./api";

export function GeofenceSettings() {
  const { data, isLoading, isError, refetch } = useGeofences();

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={3} />;

  const branches = data?.data ?? [];
  if (branches.length === 0) {
    return <EmptyState icon={MapPin} title="ยังไม่มีสาขา" description="เพิ่มสาขาก่อนตั้งค่าพื้นที่เช็คอิน" />;
  }

  return (
    <div className="space-y-4">
      <Card className="border-info/30 bg-info/5 p-4 text-sm text-info">
        กำหนดพิกัดและรัศมีของแต่ละสาขา พนักงานจะเช็คอินได้เมื่ออยู่ในรัศมีที่กำหนดเท่านั้น
        (เว้นว่างพิกัด = ปิด geofence ให้เช็คอินได้ทุกที่)
      </Card>
      {branches.map((b) => (
        <BranchGeofenceCard key={b.id} branch={b} />
      ))}
    </div>
  );
}

function BranchGeofenceCard({ branch }: { branch: Geofence }) {
  const updateMut = useUpdateGeofence();
  const [lat, setLat] = useState(branch.lat != null ? String(branch.lat) : "");
  const [lng, setLng] = useState(branch.lng != null ? String(branch.lng) : "");
  const [radius, setRadius] = useState(branch.radiusMeters != null ? String(branch.radiusMeters) : "150");
  const [locating, setLocating] = useState(false);

  const latN = lat.trim() === "" ? null : Number(lat);
  const lngN = lng.trim() === "" ? null : Number(lng);
  const hasCoords = latN != null && lngN != null && !Number.isNaN(latN) && !Number.isNaN(lngN);

  async function useMyLocation() {
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      setLat(pos.coords.latitude.toFixed(6));
      setLng(pos.coords.longitude.toFixed(6));
      toast.success("ตั้งพิกัดจากตำแหน่งปัจจุบันแล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ระบุตำแหน่งไม่สำเร็จ");
    } finally {
      setLocating(false);
    }
  }

  async function save(clear = false) {
    const payload = clear
      ? { branchId: branch.id, lat: null, lng: null, radiusMeters: null }
      : {
          branchId: branch.id,
          lat: latN,
          lng: lngN,
          radiusMeters: radius.trim() === "" ? null : Math.round(Number(radius)),
        };
    if (!clear && (latN == null || lngN == null || Number.isNaN(latN) || Number.isNaN(lngN))) {
      toast.error("กรุณากรอกพิกัด หรือกด ใช้ตำแหน่งปัจจุบัน");
      return;
    }
    try {
      await updateMut.mutateAsync(payload);
      toast.success(clear ? "ปิด geofence แล้ว" : `บันทึกพื้นที่ ${branch.name} แล้ว`);
      if (clear) {
        setLat("");
        setLng("");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <Card className="gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{branch.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {branch.address || `รหัสสาขา ${branch.code}`}
          </p>
        </div>
        <span
          className={
            hasCoords
              ? "rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success"
              : "rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
          }
        >
          {hasCoords ? "เปิด geofence" : "ปิด (เช็คอินได้ทุกที่)"}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled label="ละติจูด (Latitude)">
              <Input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" placeholder="13.736717" />
            </Labeled>
            <Labeled label="ลองจิจูด (Longitude)">
              <Input value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" placeholder="100.523186" />
            </Labeled>
            <Labeled label="รัศมี (เมตร)">
              <Input value={radius} onChange={(e) => setRadius(e.target.value)} inputMode="numeric" placeholder="150" />
            </Labeled>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating}>
              {locating ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
              ใช้ตำแหน่งปัจจุบัน
            </Button>
            <Button type="button" onClick={() => save(false)} disabled={updateMut.isPending}>
              {updateMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              บันทึกพื้นที่
            </Button>
            {hasCoords && (
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => save(true)} disabled={updateMut.isPending}>
                <Trash2 className="size-4" /> ปิด geofence
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
          {hasCoords ? (
            <iframe
              title={`แผนที่ ${branch.name}`}
              className="h-56 w-full lg:h-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps?q=${latN},${lngN}&z=16&output=embed`}
            />
          ) : (
            <div className="flex h-56 items-center justify-center text-center text-xs text-muted-foreground lg:h-full">
              ตั้งพิกัดเพื่อดูแผนที่
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
