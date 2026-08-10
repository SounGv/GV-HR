"use client";

import { useMemo } from "react";
import { useAuth } from "@/features/auth/auth-context";
import {
  MOBILE_EMPLOYEE_GROUPS,
  MOBILE_HR_GROUPS,
  type MobileMenuGroup,
} from "@/config/mobile-menu";
import { useMenuVisibility } from "./use-menu-visibility";

function filterGroups(
  groups: MobileMenuGroup[],
  can: (perm: string) => boolean,
  isVisible: (id: string) => boolean,
) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => can(item.permission) && isVisible(item.id)),
    }))
    .filter((group) => group.items.length > 0);
}

export interface MobileMenuGroups {
  groups: MobileMenuGroup[];
  /** Index into `groups` where the HR/manager zone starts — used to draw a
   * divider so those sections read as a distinct zone from the personal
   * quick-menu above, without hiding anything the account already has
   * permission to see. */
  hrStartIndex: number;
}

/** Shared across the "บริการ" full-menu view and the Home quick-menu section. */
export function useMobileMenuGroups(): MobileMenuGroups {
  const { can } = useAuth();
  const { isVisible } = useMenuVisibility();

  return useMemo(() => {
    const employee = filterGroups(MOBILE_EMPLOYEE_GROUPS, can, isVisible);
    const hr = filterGroups(MOBILE_HR_GROUPS, can, isVisible);
    return { groups: [...employee, ...hr], hrStartIndex: employee.length };
  }, [can, isVisible]);
}
