import type { Metadata } from "next";
import { Database, Calculator, Bell, Sparkles } from "lucide-react";
import { requireAiPageAccess } from "@/lib/auth/page-guard";
import { Card } from "@/components/ui/card";
import { AiChatView } from "@/features/ai/ai-chat-view";

export const metadata: Metadata = { title: "AI Assistant" };

const CAPABILITIES = [
  { icon: Database, label: "ดึงข้อมูลจริงจากระบบ" },
  { icon: Calculator, label: "คำนวณเงินเดือน/ภาษี" },
  { icon: Bell, label: "ส่งแจ้งเตือน & ประกาศ" },
  { icon: Sparkles, label: "ออกแบบเกณฑ์ประเมิน" },
];

export default async function AiPage() {
  await requireAiPageAccess();

  return (
    <div className="space-y-5">
      <Card className="relative hidden overflow-hidden border-0 bg-[var(--chat-teal)] p-6 text-white md:block">
        <div className="pointer-events-none absolute -top-16 -right-10 size-64 rounded-full bg-white/15 blur-[90px]" />
        <div className="relative flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
              <Sparkles className="size-6 text-white" />
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold">AI Assistant</p>
                <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white">
                  <span className="size-1.5 rounded-full bg-white" aria-hidden="true" /> พร้อมใช้งาน
                </span>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-white/90">
                ผู้ช่วยอัจฉริยะที่ยึดข้อมูลจริงจากฐานข้อมูลบริษัท ตอบเรื่อง HR/Payroll
                ค้นเว็บ และช่วยดำเนินการให้อัตโนมัติ
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {CAPABILITIES.map((c) => (
              <span
                key={c.label}
                className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs text-white ring-1 ring-white/20"
              >
                <c.icon className="size-3.5" aria-hidden="true" />
                {c.label}
              </span>
            ))}
          </div>
        </div>
      </Card>
      <AiChatView />
    </div>
  );
}
