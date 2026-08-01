import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { GeofenceSettings } from "@/features/geofence/geofence-settings";

export const metadata: Metadata = { title: "ตั้งค่าพื้นที่เช็คอิน" };

export default async function GeofenceSettingsPage() {
  await requirePagePermission("attendance:update");

  return (
    <div className="space-y-6">
      <PageHeader
        title="ตั้งค่าพื้นที่เช็คอิน (Geofence)"
        description="กำหนดพิกัดและรัศมีของแต่ละสาขา เพื่อบังคับให้เช็คอินได้เฉพาะในพื้นที่"
      />
      <GeofenceSettings />
    </div>
  );
}
