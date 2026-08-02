import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import { Card, CardContent } from "@/components/ui/card";
import { INTEGRATIONS } from "@/lib/integrations/adapter";

export const metadata: Metadata = { title: "รายละเอียดการเชื่อมต่อ" };

const STATUS: Record<string, { tone: StatusTone; label: string }> = {
  connected: { tone: "success", label: "เชื่อมต่อแล้ว" },
  available: { tone: "primary", label: "พร้อมเชื่อมต่อ" },
  coming_soon: { tone: "neutral", label: "เร็วๆ นี้" },
};

export default async function IntegrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("admin:read");
  const { id } = await params;
  const it = INTEGRATIONS.find((x) => x.id === id);
  if (!it) notFound();
  const st = STATUS[it.status] ?? STATUS.available;

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "การเชื่อมต่อระบบ", href: "/integrations" }, { label: it.name }]}
        backHref="/integrations"
        title={`เชื่อมต่อ ${it.name}`}
        description={it.description}
        status={<StatusChip tone={st.tone} label={st.label} />}
      />

      <Card>
        <CardContent className="max-w-lg space-y-5 pt-6">
          {it.capabilities.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">ความสามารถ</p>
              <div className="flex flex-wrap gap-1.5">
                {it.capabilities.map((c) => (
                  <span key={c} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">ข้อมูลที่ต้องใช้เชื่อมต่อ</p>
            {it.configFields.length ? (
              <ul className="space-y-1.5">
                {it.configFields.map((f) => (
                  <li
                    key={f.key}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span>{f.label}</span>
                    <span className="text-xs text-muted-foreground">{f.secret ? "🔒 secret" : "ค่า"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">ไม่ต้องตั้งค่าเพิ่มเติม</p>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-info/10 p-3 text-xs text-info">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>
              Adapter พร้อมใช้งานผ่าน Interface มาตรฐาน — ตั้งค่า credential
              โดยผู้ดูแลระบบเพื่อเปิดการเชื่อมต่อจริง (ปลอดภัย ไม่กระทบ Business Logic)
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
