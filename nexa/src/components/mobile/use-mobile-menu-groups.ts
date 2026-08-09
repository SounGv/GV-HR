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

/** Shared across the "บริการ" full-menu view and the Home quick-menu section. */
export function useMobileMenuGroups(): MobileMenuGroup[] {
  const { can } = useAuth();
  const { isVisible } = useMenuVisibility();

  return useMemo(
    () => [
      ...filterGroups(MOBILE_EMPLOYEE_GROUPS, can, isVisible),
      ...filterGroups(MOBILE_HR_GROUPS, can, isVisible),
    ],
    [can, isVisible],
  );
}
