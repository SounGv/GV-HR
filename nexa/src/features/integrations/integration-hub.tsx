"use client";

import { useMemo } from "react";
import Link from "next/link";
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
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
      {/* Adapter Pattern explainer: a plain note, not a banner. */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
        <span className="flex size-9 shrink-0 items-center justify-center text-primary">
          <Plug className="size-5" aria-hidden="true" />
        </span>
        <p className="max-w-2xl text-sm leading-relaxed">
          <b>เชื่อมต่อแบบเดียวกันทุกระบบ</b> ทุกระบบภายนอกเชื่อมผ่านช่องทางมาตรฐานเดียว จึงเปลี่ยนระบบบัญชีหรือผู้ให้บริการในอนาคตโดยไม่ต้องแก้โมดูลอื่น
        </p>
      </div>

      {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((cat) => (
        <section key={cat} className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">{CATEGORY_LABEL[cat]}</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 text-center">ลำดับ</TableHead>
                <TableHead>ระบบ</TableHead>
                <TableHead className="w-full">รายละเอียด</TableHead>
                <TableHead>ความสามารถ</TableHead>
                <TableHead className="text-center">สถานะ</TableHead>
                <TableHead className="text-center">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.get(cat)!.map((i, idx) => {
                const Icon = ICONS[i.icon] ?? Plug;
                const st = STATUS_META[i.status];
                return (
                  <TableRow key={i.id}>
                    <TableCell className="text-center tabular-nums">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        {i.status === "coming_soon" ? (
                          <span className="font-medium text-foreground">{i.name}</span>
                        ) : (
                          <Link href={`/integrations/${i.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                            {i.name}
                          </Link>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-56 whitespace-normal text-muted-foreground">{i.description}</TableCell>
                    <TableCell className="min-w-40 whitespace-normal">
                      <div className="flex flex-wrap gap-1">
                        {i.capabilities.map((c) => (
                          <span key={c} className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            {c}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium", st.cls)}>
                        <span className="size-1.5 rounded-full bg-current" aria-hidden />
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {i.status === "coming_soon" ? (
                        <Button variant="outline" size="sm" disabled>
                          เร็วๆ นี้
                        </Button>
                      ) : (
                        <Button
                          variant={i.status === "available" ? "default" : "outline"}
                          size="sm"
                          render={<Link href={`/integrations/${i.id}`} />}
                        >
                          {i.status === "connected" ? "จัดการ" : "เชื่อมต่อ"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      ))}

    </div>
  );
}
