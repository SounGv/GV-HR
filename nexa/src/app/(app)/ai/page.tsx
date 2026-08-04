import type { Metadata } from "next";
import { Database, Calculator, Bell, Sparkles } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/page-guard";
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
  await requirePagePermission("ai:read");

  return (
    <div className="space-y-5">
      <Card className="relative overflow-hidden border-0 bg-sidebar p-6 text-white">
        <div className="pointer-events-none absolute -top-16 -right-10 size-64 rounded-full bg-primary/25 blur-[90px]" />
        <div className="relative flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <Sparkles className="size-6 text-primary" />
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold">AI Assistant</p>
                <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                  <span className="size-1.5 rounded-full bg-success" /> Online
                </span>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
                ผู้ช่วยอัจฉริยะที่ยึดข้อมูลจริงจากฐานข้อมูลบริษัท ตอบเรื่อง HR/Payroll
                ค้นเว็บ และช่วยดำเนินการให้อัตโนมัติ
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {CAPABILITIES.map((c) => (
              <span
                key={c.label}
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-slate-200 ring-1 ring-white/10"
              >
                <c.icon className="size-3.5 text-primary" />
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
