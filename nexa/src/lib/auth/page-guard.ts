import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "./session";
import { can } from "./rbac";

/** Server-component guard: ensure a session + permission, else redirect. */
export async function requirePagePermission(permission: string): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.perms, permission)) redirect("/dashboard");
  return session;
}
