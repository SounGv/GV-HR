"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/auth-context";
import { MOBILE_EMPLOYEE_GROUPS, MOBILE_HR_GROUPS } from "@/config/mobile-menu";
import { MobileScreen } from "../mobile-screen";
import { useMenuVisibility } from "../use-menu-visibility";
import { MobileModuleCard } from "../mobile-ui";

function MobileToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-border",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-[18px] rounded-full bg-card transition-[left]",
          checked ? "left-5" : "left-0.5",
        )}
      />
    </button>
  );
}

/**
 * Home-menu tile visibility is a mobile-only concern (no desktop equivalent
 * to fall back to), so it stays a bespoke screen — but backed by the real
 * menu registry and persisted per-browser instead of a disconnected fake
 * toggle list. Every other GV One mobile module now renders the real
 * desktop page via the auto-shell fallback — see mobile-module-registry.ts.
 */
export function MobileMenuSettingsModule() {
  const { can } = useAuth();
  const { isVisible, setItemVisible } = useMenuVisibility();

  const items = useMemo(
    () =>
      [...MOBILE_EMPLOYEE_GROUPS, ...MOBILE_HR_GROUPS]
        .flatMap((group) => group.items)
        .filter((item) => item.id !== "menusettings" && can(item.permission)),
    [can],
  );

  return (
    <MobileScreen title="ตั้งค่าเมนูของฉัน" backHref="/services" contentClassName="flex flex-col p-0">
      <div className="p-3.5">
        <p className="mb-2.5 px-1 text-xs text-muted-foreground">
          เลือกเมนูที่จะแสดงในหน้าหลักของบัญชีนี้ ปิดเมนูที่ไม่ได้ใช้เพื่อให้หน้าหลักดูง่ายขึ้น — บันทึกไว้ในเครื่องนี้
        </p>
        <MobileModuleCard className="divide-y divide-border p-0">
          {items.map((item) => {
            const Icon = item.icon;
            const on = isVisible(item.id);
            return (
              <div key={item.id} className="flex items-center gap-3 px-3.5 py-3">
                <Icon className="size-[18px] shrink-0 text-primary" />
                <span className="flex-1 text-[13px] font-medium text-foreground">{item.label}</span>
                <MobileToggle checked={on} onChange={() => setItemVisible(item.id, !on)} />
              </div>
            );
          })}
        </MobileModuleCard>
      </div>
    </MobileScreen>
  );
}
