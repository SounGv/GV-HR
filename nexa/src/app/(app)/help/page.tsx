import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { HelpView } from "@/features/help/help-view";

export const metadata: Metadata = { title: "คู่มือการใช้งาน" };

/**
 * HR-level only (employee:update — see navigation.ts): the guide documents
 * HR-facing workflows, so it's gated the same as the nav item that links
 * here, not left open to every logged-in employee.
 */
export default async function HelpPage() {
  await requirePagePermission("employee:update");

  return (
    <div className="space-y-6">
      <PageHeader
        title="คู่มือการใช้งาน"
        description="ขั้นตอนการใช้ฟังก์ชันหลักที่ HR ใช้บ่อยที่สุด"
      />
      <HelpView />
    </div>
  );
}
