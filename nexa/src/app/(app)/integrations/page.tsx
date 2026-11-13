import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { IntegrationHub } from "@/features/integrations/integration-hub";

export const metadata: Metadata = { title: "เชื่อมต่อระบบอื่น" };

export default async function IntegrationsPage() {
  await requirePagePermission("admin:read");

  return (
    <div className="space-y-6">
      <PageHeader
        title="เชื่อมต่อระบบอื่น"
        description="เชื่อม LINE, Google, Microsoft และระบบบัญชีเข้ากับ GV One"
      />
      <IntegrationHub />
    </div>
  );
}
