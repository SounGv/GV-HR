"use client";

import { useMemo, useState } from "react";
import {
  Cloud,
  Building2,
  LayoutGrid,
  Globe,
  MessageCircle,
  HardDrive,
  Webhook,
  Share2,
  Plug,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  INTEGRATIONS,
  CATEGORY_LABEL,
  type IntegrationCategory,
  type IntegrationDescriptor,
} from "@/lib/integrations/adapter";

const ICONS: Record<string, LucideIcon> = {
  Cloud,
  Building2,
  LayoutGrid,
  Globe,
  MessageCircle,
  HardDrive,
  Webhook,
  Share2,
};

const STATUS_META = {
  connected: { label: "เชื่อมต่อแล้ว", cls: "bg-success/10 text-success" },
  available: { label: "พร้อมเชื่อมต่อ", cls: "bg-primary/10 text-primary" },
  coming_soon: { label: "เร็วๆ นี้", cls: "bg-muted text-muted-foreground" },
} as const;

const CATEGORY_ORDER: IntegrationCategory[] = ["erp", "productivity", "messaging", "storage", "api"];

export function IntegrationHub() {
  const [detail, setDetail] = useState<IntegrationDescriptor | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<IntegrationCategory, IntegrationDescriptor[]>();
    for (const i of INTEGRATIONS) {
      const arr = map.get(i.category) ?? [];
      arr.push(i);
      map.set(i.category, arr);
    }
    return map;
  }, []);

  return (
    <div className="space-y-6">
      {/* Adapter Pattern explainer */}
      <Card className="relative overflow-hidden border-0 bg-sidebar p-6 text-white">
        <div className="pointer-events-none absolute -top-20 -right-10 size-72 rounded-full bg-primary/25 blur-[90px]" />
        <div className="relative flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <Plug className="size-6 text-primary" />
          </span>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Adapter Pattern
            </p>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-200">
              ทุกระบบภายนอกเชื่อมผ่าน <b className="text-white">Interface มาตรฐานเดียว</b> —
              เปลี่ยน ERP หรือผู้ให้บริการในอนาคตได้โดย
              <b className="text-white"> ไม่ต้องแก้ Business Logic</b> ของโมดูลใดเลย
            </p>
          </div>
        </div>
      </Card>

      {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((cat) => (
        <section key={cat} className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">{CATEGORY_LABEL[cat]}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {grouped.get(cat)!.map((i) => {
              const Icon = ICONS[i.icon] ?? Plug;
              const st = STATUS_META[i.status];
              return (
                <Card key={i.id} className="gap-3 p-4 transition hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-muted">
                      <Icon className="size-5 text-foreground" />
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", st.cls)}>
                      {st.label}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{i.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{i.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {i.capabilities.map((c) => (
                      <span key={c} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {c}
                      </span>
                    ))}
                  </div>
                  <Button
                    variant={i.status === "available" ? "default" : "outline"}
                    size="sm"
                    className="mt-1 w-full"
                    disabled={i.status === "coming_soon"}
                    onClick={() => setDetail(i)}
                  >
                    {i.status === "connected" ? "จัดการ" : i.status === "available" ? "เชื่อมต่อ" : "เร็วๆ นี้"}
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>
      ))}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เชื่อมต่อ {detail?.name}</DialogTitle>
            <DialogDescription>{detail?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium">ข้อมูลที่ต้องใช้เชื่อมต่อ</p>
            {detail?.configFields.length ? (
              <ul className="space-y-1.5">
                {detail.configFields.map((f) => (
                  <li key={f.key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                    <span>{f.label}</span>
                    <span className="text-xs text-muted-foreground">{f.secret ? "🔒 secret" : "ค่า"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">ไม่ต้องตั้งค่าเพิ่มเติม</p>
            )}
            <div className="flex items-start gap-2 rounded-lg bg-info/10 p-3 text-xs text-info">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>
                Adapter พร้อมใช้งานผ่าน Interface มาตรฐาน — ตั้งค่า credential
                โดยผู้ดูแลระบบเพื่อเปิดการเชื่อมต่อจริง (ปลอดภัย ไม่กระทบ Business Logic)
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
