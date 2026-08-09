import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "./session";
import { can } from "./rbac";
import { writeAudit } from "@/lib/audit";

/** Server-component guard: ensure a session + permission, else redirect. */
export async function requirePagePermission(permission: string): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.perms, permission)) {
    writeAudit({
      companyId: session.companyId,
      actorUserId: session.sub,
      action: "permission.denied",
      entity: "Permission",
      entityId: permission,
    }).catch(() => {});
    redirect("/dashboard");
  }
  return session;
}
