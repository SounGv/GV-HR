"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/auth-context";
import {
  MOBILE_EMPLOYEE_GROUPS,
  MOBILE_HR_GROUPS,
  filterVisibleMenuItems,
  type MobileMenuGroup,
  type MobileMenuItem,
} from "@/config/mobile-menu";
import { MobileScreen } from "./mobile-screen";
import { MobileSegmentedTabs } from "./mobile-segmented-tabs";

function filterGroups(groups: MobileMenuGroup[], can: (p: string) => boolean): MobileMenuGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: filterVisibleMenuItems(group.items.filter((item) => can(item.permission))),
    }))
    .filter((group) => group.items.length > 0);
}

function MenuTile({ item }: { item: MobileMenuItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="flex flex-col items-center gap-2 rounded-2xl p-2 text-center transition active:scale-95"
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-6" />
      </span>
      <span className="line-clamp-2 text-xs font-medium text-foreground">{item.label}</span>
    </Link>
  );
}

export function MobileHomeView({ title = "GV One" }: { title?: string }) {
  const { can, user } = useAuth();
  const [tab, setTab] = useState<"employee" | "hr">("employee");

  const employeeGroups = useMemo(() => filterGroups(MOBILE_EMPLOYEE_GROUPS, can), [can]);
  const hrGroups = useMemo(() => filterGroups(MOBILE_HR_GROUPS, can), [can]);
  const showHrTab = hrGroups.length > 0;

  const groups = tab === "employee" ? employeeGroups : hrGroups;

  return (
    <MobileScreen title={title} contentClassName="space-y-5 pb-6">
      <div className="-mx-4 bg-primary px-4 pb-4 pt-1 text-primary-foreground">
        <p className="text-sm opacity-90">สวัสดี</p>
        <p className="text-lg font-semibold">
          {user.employee
            ? [user.employee.firstName, user.employee.lastName].filter(Boolean).join(" ") || user.email
            : user.email}
        </p>
        {showHrTab ? (
          <div className="mt-4">
            <MobileSegmentedTabs
              variant="onPrimary"
              value={tab}
              onChange={(v) => setTab(v as "employee" | "hr")}
              tabs={[
                { value: "employee", label: "พนักงาน" },
                { value: "hr", label: "HR" },
              ]}
            />
          </div>
        ) : null}
      </div>

      {groups.map((group) => (
        <section key={group.id} className="space-y-3">
          <h2 className="px-1 text-sm font-semibold text-foreground">{group.label}</h2>
          <div className="grid grid-cols-4 gap-3">
            {group.items.map((item) => (
              <MenuTile key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}

      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีเมนูที่แสดงได้</p>
      ) : null}
    </MobileScreen>
  );
}
