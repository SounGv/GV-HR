import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { AdminView } from "@/features/admin/admin-view";

export const metadata: Metadata = { title: "ผู้ดูแลระบบ" };

export default async function AdminPage() {
  await requirePagePermission("admin:read");

  return (
    <div className="space-y-6">
      <PageHeader title="ผู้ดูแลระบบ" description="จัดการบทบาท สิทธิ์การเข้าถึง และการมอบหมายบทบาทให้ผู้ใช้" />
      <AdminView />
    </div>
  );
}
