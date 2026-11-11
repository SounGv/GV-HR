"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/appraisal", label: "ภาพรวม" },
  { href: "/appraisal/forms", label: "แบบประเมิน" },
  { href: "/appraisal/rounds", label: "รอบประเมิน" },
  { href: "/appraisal/kpi", label: "KPI" },
  { href: "/appraisal/settings", label: "ตั้งค่า" },
] as const;

/**
 * Tabs across the evaluation system's HR pages. The sidebar has one entry
 * ("จัดการประเมิน") instead of five, so moving between overview, forms,
 * rounds, KPI and settings happens here. Shown only on those five list
 * pages (not inside a form or round, which have their own breadcrumbs) and
 * only to people who manage evaluations.
 */
export function AppraisalManageTabs() {
  const pathname = usePathname();
  const { can } = useAuth();
  if (!can("campaign:manage") || !TABS.some((t) => t.href === pathname)) return null;
  return (
    <nav aria-label="จัดการประเมิน" className="-mx-1 overflow-x-auto px-1">
      <div className="inline-flex gap-1 rounded-xl border border-border bg-card p-1 shadow-[var(--card-shadow)]">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center rounded-[9px] px-4 text-[13.5px] font-semibold whitespace-nowrap transition-colors md:h-9",
                active
                  ? "bg-[#0f766e] text-white shadow-[0_1px_2px_rgba(15,118,110,0.2),0_6px_14px_-8px_rgba(15,118,110,0.6)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
