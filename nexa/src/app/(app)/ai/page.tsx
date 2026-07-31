import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { AiChatView } from "@/features/ai/ai-chat-view";

export const metadata: Metadata = { title: "NEXA AI" };

export default async function AiPage() {
  await requirePagePermission("ai:read");

  return (
    <div className="space-y-6">
      <PageHeader
        title="NEXA AI"
        description="ผู้ช่วยอัจฉริยะที่ดึงข้อมูลจริงจากระบบ ค้นเว็บ และช่วยงาน HR ได้"
      />
      <AiChatView />
    </div>
  );
}
