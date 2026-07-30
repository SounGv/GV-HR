import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { AuthProvider } from "@/features/auth/auth-context";
import { AppShell } from "@/components/layout/app-shell";

/**
 * Authenticated shell. Server-side session gate (defense in depth beyond
 * middleware) then seeds the client AuthProvider with the resolved user.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AuthProvider user={user}>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
