"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/auth-context";
import {
  MOBILE_EMPLOYEE_GROUPS,
  MOBILE_HR_GROUPS,
  type MobileMenuGroup,
} from "@/config/mobile-menu";
import { MobileSegmentedTabs } from "./mobile-segmented-tabs";

type HomeTab = "employee" | "hr";

function filterGroups(groups: MobileMenuGroup[], can: (perm: string) => boolean) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => can(item.permission)),
    }))
    .filter((group) => group.items.length > 0);
}

export function MobileHomeView({ title = "GV One" }: { title?: string }) {
  const { can } = useAuth();
  const [tab, setTab] = useState<HomeTab>("employee");

  const groups = useMemo(() => {
    const source = tab === "employee" ? MOBILE_EMPLOYEE_GROUPS : MOBILE_HR_GROUPS;
    return filterGroups(source, can);
  }, [tab, can]);

  const showHrTab = useMemo(
    () => filterGroups(MOBILE_HR_GROUPS, can).some((g) => g.items.length > 0),
    [can],
  );

  return (
    <div className="flex min-h-full flex-col bg-muted md:hidden">
      <div className="sticky top-0 z-30 bg-primary px-4 pb-4 pt-3">
        <h1 className="mb-3 text-lg font-bold text-primary-foreground">{title}</h1>
        {showHrTab && (
          <MobileSegmentedTabs<HomeTab>
            variant="onPrimary"
            value={tab}
            onChange={setTab}
            options={[
              { value: "employee", label: "พนักงานทั่วไป" },
              { value: "hr", label: "HR" },
            ]}
          />
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-2">
        {groups.map((group) => (
          <section key={group.title}>
            <h2 className="mb-2.5 px-1 text-xs font-semibold text-muted-foreground">{group.title}</h2>
            <div className="rounded-xl border border-border bg-card px-1.5 py-4">
              <div className="grid grid-cols-4 gap-x-1 gap-y-5">
                {group.items.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex flex-col items-center gap-2 px-1 text-center transition active:scale-95"
                  >
                    <span className="flex size-[42px] items-center justify-center rounded-full border-[1.5px] border-primary bg-card text-primary">
                      <item.icon className="size-[19px]" strokeWidth={2} />
                    </span>
                    <span className="text-[11px] font-semibold leading-snug text-foreground">
                      {item.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
