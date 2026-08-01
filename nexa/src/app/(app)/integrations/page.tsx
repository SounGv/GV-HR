import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { IntegrationHub } from "@/features/integrations/integration-hub";

export const metadata: Metadata = { title: "Integration Hub" };

export default async function IntegrationsPage() {
  await requirePagePermission("admin:read");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integration Hub"
        description="เชื่อมต่อ ERP, Microsoft, Google, LINE และระบบภายนอกผ่าน Adapter Pattern"
      />
      <IntegrationHub />
    </div>
  );
}
