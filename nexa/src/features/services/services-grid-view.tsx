"use client";

import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/features/auth/auth-context";
import { NAV_GROUPS } from "@/config/navigation";

/**
 * Curated employee quick-access subset of NAV_GROUPS, ordered for a 4-col
 * grid — deliberately not the full ~25-item nav (that stays one tap away
 * via "ดูเมนูทั้งหมด" below).
 */
const CURATED_HREFS = [
  "/attendance",
  "/leave",
  "/overtime",
  "/shifts",
  "/payroll",
  "/expenses",
  "/performance",
  "/kpi",
  "/training",
  "/calendar",
  "/announcements",
  "/workflows",
];

export function ServicesGridView() {
  const { can } = useAuth();
  const { setOpenMobile } = useSidebar();

  const allItems = NAV_GROUPS.flatMap((g) => g.items);
  const tiles = CURATED_HREFS.map((href) => allItems.find((i) => i.href === href)).filter(
    (item): item is NonNullable<typeof item> => !!item && can(item.permission),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">บริการ</h1>
        <p className="text-sm text-muted-foreground">ทางลัดไปยังฟังก์ชันที่ใช้บ่อย</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {tiles.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-2 rounded-2xl p-2 text-center transition active:scale-95"
          >
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <item.icon className="size-6" />
            </span>
            <span className="text-xs font-medium text-foreground">{item.label}</span>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpenMobile(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-medium text-foreground"
      >
        <LayoutGrid className="size-4" /> ดูเมนูทั้งหมด
      </button>
    </div>
  );
}
