"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { can as rbacCan } from "@/lib/auth/rbac";
import type { CurrentUser } from "@/lib/auth/current-user";

interface AuthContextValue {
  user: CurrentUser;
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Seeded with the server-resolved user so there is no auth flash on load. */
export function AuthProvider({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const can = useCallback((permission: string) => rbacCan(user.permissions, permission), [user]);
  const canAny = useCallback(
    (permissions: string[]) => permissions.some((p) => rbacCan(user.permissions, p)),
    [user],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }, [router]);

  const value = useMemo(() => ({ user, can, canAny, logout }), [user, can, canAny, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
