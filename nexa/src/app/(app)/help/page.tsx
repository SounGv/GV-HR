import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { HelpView } from "@/features/help/help-view";

export const metadata: Metadata = { title: "คู่มือการใช้งาน" };

/**
 * Documentation only — no data, no permission gate beyond "logged in", since
 * seeing "how to do X" isn't sensitive even for a role that lacks X itself
 * (e.g. a manager who can't manage employees still benefits from reading the
 * leave-approval guide).
 */
export default async function HelpPage() {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/help");

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
