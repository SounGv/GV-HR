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
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-foreground">บริการ</h1>
        <p className="text-sm text-muted-foreground">ทางลัดไปยังฟังก์ชันที่ใช้บ่อย</p>
      </div>

      <div className="rounded-xl border border-border bg-card px-1.5 py-4">
      <div className="grid grid-cols-4 gap-x-2 gap-y-5">
        {tiles.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-2 rounded-xl p-1 text-center transition active:scale-95"
          >
            <span className="flex size-[42px] items-center justify-center rounded-full border-[1.5px] border-primary bg-card text-primary">
              <item.icon className="size-[19px]" />
            </span>
            <span className="text-[11px] font-semibold leading-snug text-foreground">{item.label}</span>
          </Link>
        ))}
      </div>
      </div>

      <button
        type="button"
        onClick={() => setOpenMobile(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3.5 text-sm font-semibold text-foreground"
      >
        <LayoutGrid className="size-4" /> ดูเมนูทั้งหมด
      </button>
    </div>
  );
}
