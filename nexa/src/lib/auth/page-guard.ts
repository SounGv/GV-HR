import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "./session";
import { can } from "./rbac";
import { writeAudit } from "@/lib/audit";
import { resolveAiAccess } from "@/lib/ai/scope";

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

/**
 * Same shape as `requirePagePermission`, but for the AI Assistant page:
 * access is role-`ai:read` OR an HR-granted per-employee AiAccessGrant (see
 * `src/lib/ai/scope.ts`) — a grant-only user has no `ai:*` permission key at
 * all, so a plain `requirePagePermission("ai:read")` would wrongly 403 them.
 */
export async function requireAiPageAccess(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  const access = await resolveAiAccess(session);
  if (!access.allowed) {
    writeAudit({
      companyId: session.companyId,
      actorUserId: session.sub,
      action: "permission.denied",
      entity: "Permission",
      entityId: "ai:read",
    }).catch(() => {});
    redirect("/dashboard");
  }
  return session;
}
