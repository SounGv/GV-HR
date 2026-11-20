import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { GeofenceSettings } from "@/features/geofence/geofence-settings";

export const metadata: Metadata = { title: "ตั้งค่าพื้นที่ลงเวลาเข้างาน" };

export default async function GeofenceSettingsPage() {
  await requirePagePermission("attendance:update");

  return (
    <div className="space-y-6">
      <PageHeader
        title="ตั้งค่าพื้นที่ลงเวลาเข้างาน"
        description="กำหนดพิกัดและรัศมีของแต่ละสาขา เพื่อบังคับให้ลงเวลาเข้างานได้เฉพาะในพื้นที่"
      />
      <GeofenceSettings />
    </div>
  );
}
