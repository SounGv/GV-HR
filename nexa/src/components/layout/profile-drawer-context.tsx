"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface ProfileDrawerContextValue {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  setOpen: (open: boolean) => void;
}

const ProfileDrawerContext = createContext<ProfileDrawerContextValue | null>(null);

/**
 * One drawer, many trigger points — the mobile bottom nav's "โปรไฟล์" tab,
 * the mobile home header's profile icon, and the desktop topbar's avatar
 * button all need to open the *same* drawer instance instead of each
 * rendering (and locally tracking open state for) its own copy. Mounted
 * once at the app-shell level; see `<ProfileDrawer />` in profile-drawer.tsx.
 */
export function ProfileDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, openDrawer, closeDrawer, setOpen }), [open, openDrawer, closeDrawer]);
  return <ProfileDrawerContext.Provider value={value}>{children}</ProfileDrawerContext.Provider>;
}

export function useProfileDrawer(): ProfileDrawerContextValue {
  const ctx = useContext(ProfileDrawerContext);
  if (!ctx) throw new Error("useProfileDrawer must be used within <ProfileDrawerProvider>");
  return ctx;
}
